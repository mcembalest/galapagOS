# Apps, Functions, and entrypoints

An [`App`](/docs/reference/modal.App) represents an application running on Modal. It groups one or more Functions for atomic deployment and acts as a shared namespace. All Functions and Clses are associated with an
App.

A [`Function`](/docs/reference/modal.Function) acts as an independent unit once it is deployed, and [scales up and down](/docs/guide/scale) independently from other Functions. If there are no live inputs to the Function then by default, no containers will run and your account will not be charged for compute resources, even if the App it belongs to is deployed.

An App can be ephemeral or deployed. You can view a list of all currently running Apps on the [`apps`](/apps) page.

The code for a Modal App defining two separate Functions might look something like this:

```python

import modal

app = modal.App(name="my-modal-app")


@app.function()
def f():
    print("Hello world!")


@app.function()
def g():
    print("Goodbye world!")

```

## Ephemeral Apps

An ephemeral App is created when you use the
[`modal run`](/docs/reference/cli/run) CLI command, or the
[`app.run`](/docs/reference/modal.App#run) method. This creates a temporary
App that only exists for the duration of your script.

Ephemeral Apps are stopped automatically when the calling program exits, or when
the server detects that the client is no longer connected.
You can use
[`--detach`](/docs/reference/cli/run) in order to keep an ephemeral App running even
after the client exits.

By using `app.run` you can run your Modal apps from within your Python scripts:

```python
def main():
    ...
    with app.run():
        some_modal_function.remote()
```

By default, running your app in this way won't propagate Modal logs and progress bar messages. To enable output, use the [`modal.enable_output`](/docs/reference/modal.enable_output) context manager:

```python
def main():
    ...
    with modal.enable_output():
        with app.run():
            some_modal_function.remote()
```

## Deployed Apps

A deployed App is created using the [`modal deploy`](/docs/reference/cli/deploy)
CLI command. The App is persisted indefinitely until you delete it via the
[web UI](/apps). Functions in a deployed App that have an attached
[schedule](/docs/guide/cron) will be run on a schedule. Otherwise, you can
invoke them manually using
[web endpoints or Python](/docs/guide/trigger-deployed-functions).

Deployed Apps are named via the [`App`](/docs/reference/modal.App#modalapp)
constructor. Re-deploying an existing `App` (based on the name) will update it
in place.

## Entrypoints for ephemeral Apps

The code that runs first when you `modal run` an App is called the "entrypoint".

You can register a local entrypoint using the
[`@app.local_entrypoint()`](/docs/reference/modal.App#local_entrypoint)
decorator. You can also use a regular Modal function as an entrypoint, in which
case only the code in global scope is executed locally.

### Argument parsing

If your entrypoint function takes arguments with primitive types, `modal run`
automatically parses them as CLI options. For example, the following function
can be called with `modal run script.py --foo 1 --bar "hello"`:

```python
# script.py

@app.local_entrypoint()
def main(foo: int, bar: str):
    some_modal_function.remote(foo, bar)
```

If you wish to use your own argument parsing library, such as `argparse`, you can instead accept a variable-length argument list for your entrypoint or your function. In this case, Modal skips CLI parsing and forwards CLI arguments as a tuple of strings. For example, the following function can be invoked with `modal run my_file.py --foo=42 --bar="baz"`:

```python
import argparse

@app.function()
def train(*arglist):
    parser = argparse.ArgumentParser()
    parser.add_argument("--foo", type=int)
    parser.add_argument("--bar", type=str)
    args = parser.parse_args(args = arglist)
```

### Manually specifying an entrypoint

If there is only one `local_entrypoint` registered,
[`modal run script.py`](/docs/reference/cli/run) will automatically use it. If
you have no entrypoint specified, and just one decorated Modal function, that
will be used as a remote entrypoint instead. Otherwise, you can direct
`modal run` to use a specific entrypoint.

For example, if you have a function decorated with
[`@app.function()`](/docs/reference/modal.App#function) in your file:

```python
# script.py

@app.function()
def f():
    print("Hello world!")


@app.function()
def g():
    print("Goodbye world!")


@app.local_entrypoint()
def main():
    f.remote()
```

Running [`modal run script.py`](/docs/reference/cli/run) will execute the `main`
function locally, which would call the `f` function remotely. However you can
instead run `modal run script.py::app.f` or `modal run script.py::app.g` to
execute `f` or `g` directly.

## Apps were once Stubs

The `modal.App` class in the client was previously called `modal.Stub`. The
old name was kept as an alias for some time, but from Modal 1.0.0 onwards,
using `modal.Stub` will result in an error.

# Managing deployments

Once you've finished using `modal run` or `modal serve` to iterate on your Modal
code, it's time to deploy. A Modal deployment creates and then persists an
application and its objects, providing the following benefits:

- Repeated application function executions will be grouped under the deployment,
  aiding observability and usage tracking. Programmatically triggering lots of
  ephemeral App runs can clutter your web and CLI interfaces.
- Function calls are much faster because deployed functions are persistent and
  reused, not created on-demand by calls. Learn how to trigger deployed
  functions in
  [Invoking deployed functions](/docs/guide/trigger-deployed-functions).
- [Scheduled functions](/docs/guide/cron) will continue scheduling separate from
  any local iteration you do, and will notify you on failure.
- [Web endpoints](/docs/guide/webhooks) keep running when you close your laptop,
  and their URL address matches the deployment name.

## Creating deployments

Deployments are created using the
[`modal deploy` command](/docs/reference/cli/app#modal-app-list).

```
 % modal deploy -m whisper_pod_transcriber.main
✓ Initialized. View app page at https://modal.com/apps/ap-PYc2Tb7JrkskFUI8U5w0KG.
✓ Created objects.
├── 🔨 Created populate_podcast_metadata.
├── 🔨 Mounted /home/ubuntu/whisper_pod_transcriber at /root/whisper_pod_transcriber
├── 🔨 Created fastapi_app => https://modal-labs-whisper-pod-transcriber-fastapi-app.modal.run
├── 🔨 Mounted /home/ubuntu/whisper_pod_transcriber/whisper_frontend/dist at /assets
├── 🔨 Created search_podcast.
├── 🔨 Created refresh_index.
├── 🔨 Created transcribe_segment.
├── 🔨 Created transcribe_episode..
└── 🔨 Created fetch_episodes.
✓ App deployed! 🎉

View Deployment: https://modal.com/apps/modal-labs/whisper-pod-transcriber
```

Running this command on an existing deployment will redeploy the App,
incrementing its version. For detail on how live deployed apps transition
between versions, see the [Updating deployments](#updating-deployments) section.

Deployments can also be created programmatically using Modal's
[Python API](/docs/reference/modal.App#deploy).

## Viewing deployments

Deployments can be viewed either on the [apps](/apps) web page or by using the
[`modal app list` command](/docs/reference/cli/app#modal-app-list).

## Updating deployments

A deployment can deploy a new App or redeploy a new version of an existing
deployed App. It's useful to understand how Modal handles the transition between
versions when an App is redeployed. In general, Modal aims to support
zero-downtime deployments by gradually transitioning traffic to the new version.

If the deployment involves building new versions of the Images used by the App,
the build process will need to complete succcessfully. The existing version of
the App will continue to handle requests during this time. Errors during the
build will abort the deployment with no change to the status of the App.

After the build completes, Modal will start to bring up new containers running
the latest version of the App. The existing containers will continue handling
requests (using the previous version of the App) until the new containers have
completed their cold start.

Once the new containers are ready, old containers will stop accepting new
requests. However, the old containers will continue running any requests they
had previously accepted. The old containers will not terminate until they have
finished processing all ongoing requests.

Any warm pool containers will also be cycled during a deployment, as the
previous version's warm pool are now outdated.

## Deployment rollbacks

To quickly reset an App back to a previous version, you can perform a deployment
_rollback_. Rollbacks can be triggered from either the App dashboard or the CLI.
Rollback deployments look like new deployments: they increment the version number
and are attributed to the user who triggered the rollback. But the App's functions
and metadata will be reset to their previous state independently of your current
App codebase.

Note that deployment rollbacks are supported only on the Team and Enterprise plans.

## Stopping deployments

Deployed apps can be stopped in the web UI by clicking the red "Stop app" button on
the App's "Overview" page, or alternatively from the command line using the
[`modal app stop` command](/docs/reference/cli/app#modal-app-stop).

Stopping an App is a destructive action. Apps cannot be restarted from this state;
a new App will need to be deployed from the same source files. Objects associated
with stopped deployments will eventually be garbage collected.

# Invoking deployed functions

Modal lets you take a function created by a
[deployment](/docs/guide/managing-deployments) and call it from other contexts.

There are two ways of invoking deployed functions. If the invoking client is
running Python, then the same
[Modal client library](https://pypi.org/project/modal/) used to write Modal code
can be used. HTTPS is used if the invoking client is not running Python and
therefore cannot import the Modal client library.

## Invoking with Python

Some use cases for Python invocation include:

- An existing Python web server (eg. Django, Flask) wants to invoke Modal
  functions.
- You have split your product or system into multiple Modal applications that
  deploy independently and call each other.

### Function lookup and invocation basics

Let's say you have a script `my_shared_app.py` and this script defines a Modal
app with a function that computes the square of a number:

```python
import modal

app = modal.App("my-shared-app")


@app.function()
def square(x: int):
    return x ** 2
```

You can deploy this app to create a persistent deployment:

```
% modal deploy shared_app.py
✓ Initialized.
✓ Created objects.
├── 🔨 Created square.
├── 🔨 Mounted /Users/erikbern/modal/shared_app.py.
✓ App deployed! 🎉

View Deployment: https://modal.com/apps/erikbern/my-shared-app
```

Let's try to run this function from a different context. For instance, let's
fire up the Python interactive interpreter:

```bash
% python
Python 3.9.5 (default, May  4 2021, 03:29:30)
[Clang 12.0.0 (clang-1200.0.32.27)] on darwin
Type "help", "copyright", "credits" or "license" for more information.
>>> import modal
>>> f = modal.Function.from_name("my-shared-app", "square")
>>> f.remote(42)
1764
>>>
```

This works exactly the same as a regular modal `Function` object. For example,
you can `.map()` over functions invoked this way too:

```bash
>>> f = modal.Function.from_name("my-shared-app", "square")
>>> f.map([1, 2, 3, 4, 5])
[1, 4, 9, 16, 25]
```

#### Authentication

The Modal Python SDK will read the token from `~/.modal.toml` which typically is
created using `modal token new`.

Another method of providing the credentials is to set the environment variables
`MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`. If you want to call a Modal function
from a context such as a web server, you can expose these environment variables
to the process.

#### Lookup of lifecycle functions

[Lifecycle functions](/docs/guide/lifecycle-functions) are defined on classes,
which you can look up in a different way. Consider this code:

```python
import modal

app = modal.App("my-shared-app")


@app.cls()
class MyLifecycleClass:
    @modal.enter()
    def enter(self):
        self.var = "hello world"

    @modal.method()
    def foo(self):
        return self.var
```

Let's say you deploy this app. You can then call the function by doing this:

```bash
>>> cls = modal.Cls.from_name("my-shared-app", "MyLifecycleClass")
>>> obj = cls()  # You can pass any constructor arguments here
>>> obj.foo.remote()
'hello world'
```

### Asynchronous invocation

In certain contexts, a Modal client will need to trigger Modal functions without
waiting on the result. This is done by spawning functions and receiving a
[`FunctionCall`](/docs/reference/modal.FunctionCall) as a
handle to the triggered execution.

The following is an example of a Flask web server (running outside Modal) which
accepts model training jobs to be executed within Modal. Instead of the HTTP
POST request waiting on a training job to complete, which would be infeasible,
the relevant Modal function is spawned and the
[`FunctionCall`](/docs/reference/modal.FunctionCall)
object is stored for later polling of execution status.

```python
from uuid import uuid4
from flask import Flask, jsonify, request

app = Flask(__name__)
pending_jobs = {}

...

@app.route("/jobs", methods = ["POST"])
def create_job():
    predict_fn = modal.Function.from_name("example", "train_model")
    job_id = str(uuid4())
    function_call = predict_fn.spawn(
        job_id=job_id,
        params=request.json,
    )
    pending_jobs[job_id] = function_call
    return {
        "job_id": job_id,
        "status": "pending",
    }
```

### Importing a Modal function between Modal apps

You can also import one function defined in an app from another app:

```python
import modal

app = modal.App("another-app")

square = modal.Function.from_name("my-shared-app", "square")


@app.function()
def cube(x):
    return x * square.remote(x)


@app.local_entrypoint()
def main():
    assert cube.remote(42) == 74088
```

### Comparison with HTTPS

Compared with HTTPS invocation, Python invocation has the following benefits:

- Avoids the need to create web endpoint functions.
- Avoids handling serialization of request and response data between Modal and
  your client.
- Uses the Modal client library's built-in authentication.
  - Web endpoints are public to the entire internet, whereas function `lookup`
    only exposes your code to you (and your org).
- You can work with shared Modal functions as if they are normal Python
  functions, which might be more convenient.

## Invoking with HTTPS

Any non-Python application client can interact with deployed Modal applications
via [web endpoint functions](/docs/guide/webhooks).

Anything able to make HTTPS requests can trigger a Modal web endpoint function.
Note that all deployed web endpoint functions have
[a stable HTTPS URL](/docs/guide/webhook-urls).

Some use cases for HTTPS invocation include:

- Calling Modal functions from a web browser client running Javascript
- Calling Modal functions from non-Python backend services (Java, Go, Ruby,
  NodeJS, etc)
- Calling Modal functions using UNIX tools (`curl`, `wget`)

However, if the client of your Modal deployment is running Python, it's better
to use the [Modal client library](https://pypi.org/project/modal/) to invoke
your Modal code.

For more detail on setting up functions for invocation over HTTP see the
[web endpoints guide](/docs/guide/webhooks).

# Continuous deployment

It's a common pattern to auto-deploy your Modal App as part of a CI/CD pipeline.
To get you started, below is a guide to doing continuous deployment of a Modal
App in GitHub.

## GitHub Actions

Here's a sample GitHub Actions workflow that deploys your App on every push to
the `main` branch.

This requires you to create a [Modal token](/settings/tokens) and add it as a
[secret for your Github Actions workflow](https://github.com/Azure/actions-workflow-samples/blob/master/assets/create-secrets-for-GitHub-workflows.md).

After setting up secrets, create a new workflow file in your repository at
`.github/workflows/ci-cd.yml` with the following contents:

```yaml
name: CI/CD

on:
  push:
    branches:
      - main

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    env:
      MODAL_TOKEN_ID: ${{ secrets.MODAL_TOKEN_ID }}
      MODAL_TOKEN_SECRET: ${{ secrets.MODAL_TOKEN_SECRET }}

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Install Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.10"

      - name: Install Modal
        run: |
          python -m pip install --upgrade pip
          pip install modal

      - name: Deploy job
        run: |
          modal deploy -m my_package.my_file
```

Be sure to replace `my_package.my_file` with your actual entrypoint.

If you use multiple Modal [Environments](/docs/guide/environments), you can
additionally specify the target environment in the YAML using
`MODAL_ENVIRONMENT=xyz`.

# Running untrusted code in Functions

Modal provides two primitives for running untrusted code: Restricted Functions and [Sandboxes](/docs/guide/sandbox). While both can be used for running untrusted code, they serve different purposes: Sandboxes provide a container-like interface while Restricted Functions provide an interface similar to a traditional Function.

Restricted Functions are useful for executing:

- Code generated by language models (LLMs)
- User-submitted code in interactive environments
- Third-party plugins or extensions

## Using `restrict_modal_access`

To restrict a Function's access to Modal resources, set `restrict_modal_access=True` on the Function definition:

```python
import modal

app = modal.App()

@app.function(restrict_modal_access=True)
def run_untrusted_code(code_input: str):
    # This function cannot access Modal resources
    return eval(code_input)
```

When `restrict_modal_access` is enabled:

- The Function cannot access Modal resources (Queues, Dicts, etc.)
- The Function cannot call other Functions
- The Function cannot access Modal's internal APIs

## Comparison with Sandboxes

While both `restrict_modal_access` and [Sandboxes](/docs/guide/sandbox) can be used for running untrusted code, they serve different purposes:

| Feature   | Restricted Function            | Sandbox                                        |
| --------- | ------------------------------ | ---------------------------------------------- |
| State     | Stateless                      | Stateful                                       |
| Interface | Function-like                  | Container-like                                 |
| Setup     | Simple decorator               | Requires explicit creation/termination         |
| Use case  | Quick, isolated code execution | Interactive development, long-running sessions |

## Best Practices

When running untrusted code, consider these additional security measures:

1. Use `max_inputs=1` to ensure each container only handles one request. Containers that get reused could cause information leakage between users.

```python
@app.function(restrict_modal_access=True, max_inputs=1)
def isolated_function(input_data):
    # Each input gets a fresh container
    return process(input_data)
```

2. Set appropriate timeouts to prevent long-running operations:

```python
@app.function(
    restrict_modal_access=True,
    timeout=30,  # 30 second timeout
    max_inputs=1
)
def time_limited_function(input_data):
    return process(input_data)
```

3. Consider using `block_network=True` to prevent the container from making outbound network requests:

```python
@app.function(
    restrict_modal_access=True,
    block_network=True,
    max_inputs=1
)
def network_isolated_function(input_data):
    return process(input_data)
```

## Example: Running LLM-generated Code

Below is a complete example of running code generated by a language model:

```python
import modal

app = modal.App("restricted-access-example")


@app.function(restrict_modal_access=True, max_inputs=1, timeout=30, block_network=True)
def run_llm_code(generated_code: str):
    try:
        # Create a restricted environment
        execution_scope = {}

        # Execute the generated code
        exec(generated_code, execution_scope)

        # Return the result if it exists
        return execution_scope.get("result", None)
    except Exception as e:
        return f"Error executing code: {str(e)}"


@app.local_entrypoint()
def main():
    # Example LLM-generated code
    code = """
def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

result = calculate_fibonacci(10)
    """

    result = run_llm_code.remote(code)
    print(f"Result: {result}")

```

This example locks down the container to ensure that the code is safe to execute by:

- Restricting Modal access
- Using a fresh container for each execution
- Setting a timeout
- Blocking network access
- Catching and handling potential errors

## Error Handling

When a restricted Function attempts to access Modal resources, it will raise an `AuthError`:

```python
@app.function(restrict_modal_access=True)
def restricted_function(q: modal.Queue):
    try:
        # This will fail because the Function is restricted
        return q.get()
    except modal.exception.AuthError as e:
        return f"Access denied: {e}"
```

The error message will indicate that the operation is not permitted due to restricted Modal access.
