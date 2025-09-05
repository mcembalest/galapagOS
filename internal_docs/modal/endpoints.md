# Web endpoints

This guide explains how to set up web endpoints with Modal.

All deployed Modal Functions can be [invoked from any other Python application](/docs/guide/trigger-deployed-functions)
using the Modal client library. We additionally provide multiple ways to expose
your Functions over the web for non-Python clients.

You can [turn any Python function into a web endpoint](#simple-endpoints) with a single line
of code, you can [serve a full app](#serving-asgi-and-wsgi-apps) using
frameworks like FastAPI, Django, or Flask, or you can
[serve anything that speaks HTTP and listens on a port](#non-asgi-web-servers).

Below we walk through each method, assuming you're familiar with web applications outside of Modal.
For a detailed walkthrough of basic web endpoints on Modal aimed at developers new to web applications,
see [this tutorial](/docs/examples/basic_web).

## Simple endpoints

The easiest way to create a web endpoint from an existing Python function is to use the
[`@modal.fastapi_endpoint` decorator](/docs/reference/modal.fastapi_endpoint).

```python
image = modal.Image.debian_slim().pip_install("fastapi[standard]")


@app.function(image=image)
@modal.fastapi_endpoint()
def f():
    return "Hello world!"
```

This decorator wraps the Modal Function in a
[FastAPI application](#how-do-web-endpoints-run-in-the-cloud).

_Note: Prior to v0.73.82, this function was named `@modal.web_endpoint`_.

### Developing with `modal serve`

You can run this code as an ephemeral app, by running the command

```shell
modal serve server_script.py
```

Where `server_script.py` is the file name of your code. This will create an
ephemeral app for the duration of your script (until you hit Ctrl-C to stop it).
It creates a temporary URL that you can use like any other REST endpoint. This
URL is on the public internet.

The `modal serve` command will live-update an app when any of its supporting
files change.

Live updating is particularly useful when working with apps containing web
endpoints, as any changes made to web endpoint handlers will show up almost
immediately, without requiring a manual restart of the app.

### Deploying with `modal deploy`

You can also deploy your app and create a persistent web endpoint in the cloud
by running `modal deploy`:

<Asciinema recordingId="jYpIj1nL6JI9cw4W77GV2l5Wl" />

### Passing arguments to an endpoint

When using `@modal.fastapi_endpoint`, you can add
[query parameters](https://fastapi.tiangolo.com/tutorial/query-params/) which
will be passed to your Function as arguments. For instance

```python
image = modal.Image.debian_slim().pip_install("fastapi[standard]")


@app.function(image=image)
@modal.fastapi_endpoint()
def square(x: int):
    return {"square": x**2}
```

If you hit this with a URL-encoded query string with the `x` parameter present,
the Function will receive the value as an argument:

```
$ curl https://modal-labs--web-endpoint-square-dev.modal.run?x=42
{"square":1764}
```

If you want to use a `POST` request, you can use the `method` argument to
`@modal.fastapi_endpoint` to set the HTTP verb. To accept any valid JSON object,
[use `dict` as your type annotation](https://fastapi.tiangolo.com/tutorial/body-nested-models/?h=dict#bodies-of-arbitrary-dicts)
and FastAPI will handle the rest.

```python
image = modal.Image.debian_slim().pip_install("fastapi[standard]")


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def square(item: dict):
    return {"square": item['x']**2}
```

This now creates an endpoint that takes a JSON body:

```
$ curl -X POST -H 'Content-Type: application/json' --data-binary '{"x": 42}' https://modal-labs--web-endpoint-square-dev.modal.run
{"square":1764}
```

This is often the easiest way to get started, but note that FastAPI recommends
that you use
[typed Pydantic models](https://fastapi.tiangolo.com/tutorial/body/) in order to
get automatic validation and documentation. FastAPI also lets you pass data to
web endpoints in other ways, for instance as
[form data](https://fastapi.tiangolo.com/tutorial/request-forms/) and
[file uploads](https://fastapi.tiangolo.com/tutorial/request-files/).

## How do web endpoints run in the cloud?

Note that web endpoints, like everything else on Modal, only run when they need
to. When you hit the web endpoint the first time, it will boot up the container,
which might take a few seconds. Modal keeps the container alive for a short
period in case there are subsequent requests. If there are a lot of requests,
Modal might create more containers running in parallel.

For the shortcut `@modal.fastapi_endpoint` decorator, Modal wraps your function in a
[FastAPI](https://fastapi.tiangolo.com/) application. This means that the
[Image](/docs/guide/images)
your Function uses must have FastAPI installed, and the Functions that you write
need to follow its request and response
[semantics](https://fastapi.tiangolo.com/tutorial). Web endpoint Functions can use
all of FastAPI's powerful features, such as Pydantic models for automatic validation,
typed query and path parameters, and response types.

Here's everything together, combining Modal's abilities to run functions in
user-defined containers with the expressivity of FastAPI:

```python
import modal
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

image = modal.Image.debian_slim().pip_install("fastapi[standard]", "boto3")
app = modal.App(image=image)


class Item(BaseModel):
    name: str
    qty: int = 42


@app.function()
@modal.fastapi_endpoint(method="POST")
def f(item: Item):
    import boto3
    # do things with boto3...
    return HTMLResponse(f"<html>Hello, {item.name}!</html>")
```

This endpoint definition would be called like so:

```bash
curl -d '{"name": "Erik", "qty": 10}' \
    -H "Content-Type: application/json" \
    -X POST https://ecorp--web-demo-f-dev.modal.run
```

Or in Python with the [`requests`](https://pypi.org/project/requests/) library:

```python
import requests

data = {"name": "Erik", "qty": 10}
requests.post("https://ecorp--web-demo-f-dev.modal.run", json=data, timeout=10.0)
```

## Serving ASGI and WSGI apps

You can also serve any app written in an
[ASGI](https://asgi.readthedocs.io/en/latest/) or
[WSGI](https://en.wikipedia.org/wiki/Web_Server_Gateway_Interface)-compatible
web framework on Modal.

ASGI provides support for async web frameworks. WSGI provides support for
synchronous web frameworks.

### ASGI apps - FastAPI, FastHTML, Starlette

For ASGI apps, you can create a function decorated with
[`@modal.asgi_app`](/docs/reference/modal.asgi_app) that returns a reference to
your web app:

```python
image = modal.Image.debian_slim().pip_install("fastapi[standard]")

@app.function(image=image)
@modal.concurrent(max_inputs=100)
@modal.asgi_app()
def fastapi_app():
    from fastapi import FastAPI, Request

    web_app = FastAPI()


    @web_app.post("/echo")
    async def echo(request: Request):
        body = await request.json()
        return body

    return web_app
```

Now, as before, when you deploy this script as a Modal App, you get a URL for
your app that you can hit:

<Asciinema recordingId="fNSKPUK5hiiFgQEx0pDaMCYBg" />

The `@modal.concurrent` decorator enables a single container
to process multiple inputs at once, taking advantage of the asynchronous
event loops in ASGI applications. See [this guide](/docs/guide/concurrent-inputs)
for details.

#### ASGI Lifespan

While we recommend using [`@modal.enter`](https://modal.com/docs/guide/lifecycle-functions#enter) for defining container lifecycle hooks, we also support the [ASGI lifespan protocol](https://asgi.readthedocs.io/en/latest/specs/lifespan.html). Lifespans begin when containers start, typically at the time of the first request. Here's an example using [FastAPI](https://fastapi.tiangolo.com/advanced/events/#lifespan):

```python
import modal

app = modal.App("fastapi-lifespan-app")

image = modal.Image.debian_slim().pip_install("fastapi[standard]")

@app.function(image=image)
@modal.asgi_app()
def fastapi_app_with_lifespan():
    from fastapi import FastAPI, Request

    def lifespan(wapp: FastAPI):
        print("Starting")
        yield
        print("Shutting down")

    web_app = FastAPI(lifespan=lifespan)

    @web_app.get("/")
    async def hello(request: Request):
        return "hello"

    return web_app
```

### WSGI apps - Django, Flask

You can serve WSGI apps using the
[`@modal.wsgi_app`](/docs/reference/modal.wsgi_app) decorator:

```python
image = modal.Image.debian_slim().pip_install("flask")


@app.function(image=image)
@modal.concurrent(max_inputs=100)
@modal.wsgi_app()
def flask_app():
    from flask import Flask, request

    web_app = Flask(__name__)


    @web_app.post("/echo")
    def echo():
        return request.json

    return web_app
```

See [Flask's docs](https://flask.palletsprojects.com/en/2.1.x/deploying/asgi/)
for more information on using Flask as a WSGI app.

Because WSGI apps are synchronous, concurrent inputs will be run on separate
threads. See [this guide](/docs/guide/concurrent-inputs) for details.

## Non-ASGI web servers

Not all web frameworks offer an ASGI or WSGI interface. For example,
[`aiohttp`](https://docs.aiohttp.org/) and [`tornado`](https://www.tornadoweb.org/)
use their own asynchronous network binding, while others like
[`text-generation-inference`](https://github.com/huggingface/text-generation-inference)
actually expose a Rust-based HTTP server running as a subprocess.

For these cases, you can use the
[`@modal.web_server`](/docs/reference/modal.web_server) decorator to "expose" a
port on the container:

```python
@app.function()
@modal.concurrent(max_inputs=100)
@modal.web_server(8000)
def my_file_server():
    import subprocess
    subprocess.Popen("python -m http.server -d / 8000", shell=True)
```

Just like all web endpoints on Modal, this is only run on-demand. The function
is executed on container startup, creating a file server at the root directory.
When you hit the web endpoint URL, your request will be routed to the file
server listening on port `8000`.

For `@web_server` endpoints, you need to make sure that the application binds to
the external network interface, not just localhost. This usually means binding
to `0.0.0.0` instead of `127.0.0.1`.

See our examples of how to serve [Streamlit](/docs/examples/serve_streamlit) and
[ComfyUI](/docs/examples/comfyapp) on Modal.

## Serve many configurations with parametrized functions

Python functions that launch ASGI/WSGI apps or web servers on Modal
cannot take arguments.

One simple pattern for allowing client-side configuration of these web endpoints
is to use [parametrized functions](/docs/guide/parametrized-functions).
Each different choice for the values of the parameters will create a distinct
auto-scaling container pool.

```python
@app.cls()
@modal.concurrent(max_inputs=100)
class Server:
    root: str = modal.parameter(default=".")

    @modal.web_server(8000)
    def files(self):
        import subprocess
        subprocess.Popen(f"python -m http.server -d {self.root} 8000", shell=True)
```

The values are provided in URLs as query parameters:

```bash
curl https://ecorp--server-files.modal.run		# use the default value
curl https://ecorp--server-files.modal.run?root=.cache  # use a different value
curl https://ecorp--server-files.modal.run?root=%2F	# don't forget to URL encode!
```

For details, see [this guide to parametrized functions](/docs/guide/parametrized-functions).

## WebSockets

Functions annotated with `@web_server`, `@asgi_app`, or `@wsgi_app` also support
the WebSocket protocol. Consult your web framework for appropriate documentation
on how to use WebSockets with that library.

WebSockets on Modal maintain a single function call per connection, which can be
useful for keeping state around. Most of the time, you will want to set your
handler function to [allow concurrent inputs](/docs/guide/concurrent-inputs),
which allows multiple simultaneous WebSocket connections to be handled by the
same container.

We support the full WebSocket protocol as per
[RFC 6455](https://www.rfc-editor.org/rfc/rfc6455), but we do not yet have
support for [RFC 8441](https://www.rfc-editor.org/rfc/rfc8441) (WebSockets over
HTTP/2) or [RFC 7692](https://datatracker.ietf.org/doc/html/rfc7692)
(`permessage-deflate` extension). WebSocket messages can be up to 2 MiB each.

## Performance and scaling

If you have no active containers when the web endpoint receives a request, it will
experience a "cold start". Consult the guide page on
[cold start performance](/docs/guide/cold-start) for more information on when
Functions will cold start and advice how to mitigate the impact.

If your Function uses `@modal.concurrent`, multiple requests to the same
endpoint may be handled by the same container. Beyond this limit, additional
containers will start up to scale your App horizontally. When you reach the
Function's limit on containers, requests will queue for handling.

Each workspace on Modal has a rate limit on total operations. For a new account,
this is set to 200 function inputs or web endpoint requests per second, with a
burst multiplier of 5 seconds. If you reach the rate limit, excess requests to
web endpoints will return a
[429 status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429),
and you'll need to [get in touch](mailto:support@modal.com) with us about
raising the limit.

Web endpoint request bodies can be up to 4 GiB, and their response bodies are
unlimited in size.

## Authentication

Modal offers first-class web endpoint protection via [proxy auth tokens](https://modal.com/docs/guide/webhook-proxy-auth).
Proxy auth tokens protect web endpoints by requiring a key and token combination to be passed
in the `Modal-Key` and `Modal-Secret` headers.
Modal works as a proxy, rejecting requests that aren't authorized to access
your endpoint.

We also support standard techniques for securing web servers.

### Token-based authentication

This is easy to implement in whichever framework you're using. For example, if
you're using `@modal.fastapi_endpoint` or `@modal.asgi_app` with FastAPI, you
can validate a Bearer token like this:

```python
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import modal

image = modal.Image.debian_slim().pip_install("fastapi[standard]")
app = modal.App("auth-example", image=image)

auth_scheme = HTTPBearer()


@app.function(secrets=[modal.Secret.from_name("my-web-auth-token")])
@modal.fastapi_endpoint()
async def f(request: Request, token: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    import os

    print(os.environ["AUTH_TOKEN"])

    if token.credentials != os.environ["AUTH_TOKEN"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Function body
    return "success!"
```

This assumes you have a [Modal Secret](https://modal.com/secrets) named
`my-web-auth-token` created, with contents `{AUTH_TOKEN: secret-random-token}`.
Now, your endpoint will return a 401 status code except when you hit it with the
correct `Authorization` header set (note that you have to prefix the token with
`Bearer `):

```bash
curl --header "Authorization: Bearer secret-random-token" https://modal-labs--auth-example-f.modal.run
```

### Client IP address

You can access the IP address of the client making the request. This can be used
for geolocation, whitelists, blacklists, and rate limits.

```python
from fastapi import Request

import modal

image = modal.Image.debian_slim().pip_install("fastapi[standard]")
app = modal.App(image=image)


@app.function()
@modal.fastapi_endpoint()
def get_ip_address(request: Request):
    return f"Your IP address is {request.client.host}"
```


# Streaming endpoints

Modal web endpoints support streaming responses using FastAPI's
[`StreamingResponse`](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)
class. This class accepts asynchronous generators, synchronous generators, or
any Python object that implements the
[_iterator protocol_](https://docs.python.org/3/library/stdtypes.html#typeiter),
and can be used with Modal Functions!

## Simple example

This simple example combines Modal's `@modal.fastapi_endpoint` decorator with a
`StreamingResponse` object to produce a real-time SSE response.

```python
import time

def fake_event_streamer():
    for i in range(10):
        yield f"data: some data {i}\n\n".encode()
        time.sleep(0.5)


@app.function(image=modal.Image.debian_slim().pip_install("fastapi[standard]"))
@modal.fastapi_endpoint()
def stream_me():
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        fake_event_streamer(), media_type="text/event-stream"
    )
```

If you serve this web endpoint and hit it with `curl`, you will see the ten SSE
events progressively appear in your terminal over a ~5 second period.

```shell
curl --no-buffer https://modal-labs--example-streaming-stream-me.modal.run
```

The MIME type of `text/event-stream` is important in this example, as it tells
the downstream web server to return responses immediately, rather than buffering
them in byte chunks (which is more efficient for compression).

You can still return other content types like large files in streams, but they
are not guaranteed to arrive as real-time events.

## Streaming responses with `.remote`

A Modal Function wrapping a generator function body can have its response passed
directly into a `StreamingResponse`. This is particularly useful if you want to
do some GPU processing in one Modal Function that is called by a CPU-based web
endpoint Modal Function.

```python
@app.function(gpu="any")
def fake_video_render():
    for i in range(10):
        yield f"data: finished processing some data from GPU {i}\n\n".encode()
        time.sleep(1)


@app.function(image=modal.Image.debian_slim().pip_install("fastapi[standard]"))
@modal.fastapi_endpoint()
def hook():
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        fake_video_render.remote_gen(), media_type="text/event-stream"
    )
```

## Streaming responses with `.map` and `.starmap`

You can also combine Modal Function parallelization with streaming responses,
enabling applications to service a request by farming out to dozens of
containers and iteratively returning result chunks to the client.

```python
@app.function()
def map_me(i):
    return f"segment {i}\n"


@app.function(image=modal.Image.debian_slim().pip_install("fastapi[standard]"))
@modal.fastapi_endpoint()
def mapped():
    from fastapi.responses import StreamingResponse
    return StreamingResponse(map_me.map(range(10)), media_type="text/plain")
```

This snippet will spread the ten `map_me(i)` executions across containers, and
return each string response part as it completes. By default the results will be
ordered, but if this isn't necessary pass `order_outputs=False` as keyword
argument to the `.map` call.

### Asynchronous streaming

The example above uses a synchronous generator, which automatically runs on its
own thread, but in asynchronous applications, a loop over a `.map` or `.starmap`
call can block the event loop. This will stop the `StreamingResponse` from
returning response parts iteratively to the client.

To avoid this, you can use the `.aio()` method to convert a synchronous `.map`
into its async version. Also, other blocking calls should be offloaded to a
separate thread with `asyncio.to_thread()`. For example:

```python
@app.function(gpu="any", image=modal.Image.debian_slim().pip_install("fastapi[standard]"))
@modal.fastapi_endpoint()
async def transcribe_video(request):
    from fastapi.responses import StreamingResponse

    segments = await asyncio.to_thread(split_video, request)
    return StreamingResponse(wrapper(segments), media_type="text/event-stream")


# Notice that this is an async generator.
async def wrapper(segments):
    async for partial_result in transcribe_video.map.aio(segments):
        yield "data: " + partial_result + "\n\n"
```

## Further examples

- Complete code the for the simple examples given above is available
  [in our modal-examples Github repository](https://github.com/modal-labs/modal-examples/blob/main/07_web_endpoints/streaming.py).
- [An end-to-end example of streaming Youtube video transcriptions with OpenAI's whisper model.](https://github.com/modal-labs/modal-examples/blob/main/06_gpu_and_ml/openai_whisper/streaming/main.py)

# Web endpoint URLs

This guide documents the behavior of URLs for [web endpoints](/docs/guide/webhooks)
on Modal: automatic generation, configuration, programmatic retrieval, and more.

## Determine the URL of a web endpoint from code

Modal Functions with the
[`fastapi_endpoint`](/docs/reference/modal.fastapi_endpoint),
[`asgi_app`](/docs/reference/modal.asgi_app),
[`wsgi_app`](/docs/reference/modal.wsgi_app),
or [`web_server`](/docs/reference/modal.web_server) decorator
are made available over the Internet when they are
[`serve`d](/docs/reference/cli/serve) or [`deploy`ed](/docs/reference/cli/deploy)
and so they have a URL.

This URL is displayed in the `modal` CLI output
and is available in the Modal [dashboard](/apps) for the Function.

To determine a Function's URL programmatically,
check its [`get_web_url()`](/docs/reference/modal.Function#get_web_url)
property:

```python
@app.function(image=modal.Image.debian_slim().pip_install("fastapi[standard]"))
@modal.fastapi_endpoint(docs=True)
def show_url() -> str:
    return show_url.get_web_url()
```

For deployed Functions, this also works from other Python code!
You just need to do a [`from_name`](/docs/reference/modal.Function#from_name)
based on the name of the Function and its [App](/docs/guide/apps):

```python notest
import requests

remote_function = modal.Function.from_name("app", "show_url")
remote_function.get_web_url() == requests.get(handle.get_web_url()).json()
```

## Auto-generated URLs

By default, Modal Functions
will be served from the `modal.run` domain.
The full URL will be constructed from a number of pieces of information
to uniquely identify the endpoint.

At a high-level, web endpoint URLs for deployed applications have the
following structure: `https://<source>--<label>.modal.run`.

The `source` component represents the workspace and environment where the App is
deployed. If your workspace has only a single environment, the `source` will
just be the workspace name. Multiple environments are disambiguated by an
["environment suffix"](/docs/guide/environments#environment-web-suffixes), so
the full source would be `<workspace>-<suffix>`. However, one environment per
workspace is allowed to have a null suffix, in which case the source would just
be `<workspace>`.

The `label` component represents the specific App and Function that the endpoint
routes to. By default, these are concatenated with a hyphen, so the label would
be `<app>-<function>`.

These components are normalized to contain only lowercase letters, numerals, and dashes.

To put this all together, consider the following example. If a member of the
`ECorp` workspace uses the `main` environment (which has `prod` as its web
suffix) to deploy the `text_to_speech` app with a webhook for the `flask-app`
function, the URL will have the following components:

- _Source_:
  - _Workspace name slug_: `ECorp` → `ecorp`
  - _Environment web suffix slug_: `main` → `prod`
- _Label_:
  - _App name slug_: `text_to_speech` → `text-to-speech`
  - _Function name slug_: `flask_app` → `flask-app`

The full URL will be `https://ecorp-prod--text-to-speech-flask-app.modal.run`.

## User-specified labels

It's also possible to customize the `label` used for each Function
by passing a parameter to the relevant endpoint decorator:

```python
import modal

image = modal.Image.debian_slim().pip_install("fastapi")
app = modal.App(name="text_to_speech", image=image)


@app.function()
@modal.fastapi_endpoint(label="speechify")
def web_endpoint_handler():
    ...
```

Building on the example above, this code would produce the following URL:
`https://ecorp-prod--speechify.modal.run`.

User-specified labels are not automatically normalized, but labels with
invalid characters will be rejected.

## Ephemeral apps

To support development workflows, webhooks for ephemeral apps (i.e., apps
created with `modal serve`) will have a `-dev` suffix appended to their URL
label (regardless of whether the label is auto-generated or user-specified).
This prevents development work from interfering with deployed versions of the
same app.

If an ephemeral app is serving a webhook while another ephemeral webhook is
created seeking the same web endpoint label, the new function will _steal_ the
running webhook's label.

This ensures that the latest iteration of the ephemeral function is
serving requests and that older ones stop receiving web traffic.

## Truncation

If a generated subdomain label is longer than 63 characters, it will be
truncated.

For example, the following subdomain label is too long, 67 characters:
`ecorp--text-to-speech-really-really-realllly-long-function-name-dev`.

The truncation happens by calculating a SHA-256 hash of the overlong label, then
taking the first 6 characters of this hash. The overlong subdomain label is
truncated to 56 characters, and then joined by a dash to the hash prefix. In
the above example, the resulting URL would be
`ecorp--text-to-speech-really-really-rea-1b964b-dev.modal.run`.

The combination of the label hashing and truncation provides a unique list of 63
characters, complying with both DNS system limits and uniqueness requirements.

## Custom domains

**Custom domains are available on our
[Team and Enterprise plans](/settings/plans).**

For more customization, you can use your own domain names with Modal web
endpoints. If your [plan](/pricing) supports custom domains, visit the [Domains
tab](/settings/domains) in your workspace settings to add a domain name to your
workspace.

You can use three kinds of domains with Modal:

- **Apex:** root domain names like `example.com`
- **Subdomain:** single subdomain entries such as `my-app.example.com`,
  `api.example.com`, etc.
- **Wildcard domain:** either in a subdomain like `*.example.com`, or in a
  deeper level like `*.modal.example.com`

You'll be asked to update your domain DNS records with your domain name
registrar and then validate the configuration in Modal. Once the records have
been properly updated and propagated, your custom domain will be ready to use.

You can assign any Modal web endpoint to any registered domain in your workspace
with the `custom_domains` argument.

```python
import modal

app = modal.App("custom-domains-example")


@app.function()
@modal.fastapi_endpoint(custom_domains=["api.example.com"])
def hello(message: str):
    return {"message": f"hello {message}"}
```

You can then run `modal deploy` to put your web endpoint online, live.

```shell
$ curl -s https://api.example.com?message=world
{"message": "hello world"}
```

Note that Modal automatically generates and renews TLS certificates for your
custom domains. Since we do this when your domain is first accessed, there may
be an additional 1-2s latency on the first request. Additional requests use a
cached certificate.

You can also register multiple domain names and associate them with the same web
endpoint.

```python
import modal

app = modal.App("custom-domains-example-2")


@app.function()
@modal.fastapi_endpoint(custom_domains=["api.example.com", "api.example.net"])
def hello(message: str):
    return {"message": f"hello {message}"}
```

For **Wildcard** domains, Modal will automatically resolve arbitrary custom
endpoints (and issue TLS certificates). For example, if you add the wildcard
domain `*.example.com`, then you can create any custom domains under
`example.com`:

```python
import random
import modal

app = modal.App("custom-domains-example-2")

random_domain_name = random.choice(range(10))


@app.function()
@modal.fastapi_endpoint(custom_domains=[f"{random_domain_name}.example.com"])
def hello(message: str):
    return {"message": f"hello {message}"}
```

Custom domains can also be used with
[ASGI](https://modal.com/docs/reference/modal.asgi_app#modalasgi_app) or
[WSGI](https://modal.com/docs/reference/modal.wsgi_app) apps using the same
`custom_domains` argument.

# Request timeouts

Web endpoint (a.k.a. webhook) requests should complete quickly, ideally within a
few seconds. All web endpoint function types
([`web_endpoint`, `asgi_app`, `wsgi_app`](/docs/reference/modal.web_endpoint))
have a maximum HTTP request timeout of 150 seconds enforced. However, the
underlying Modal function can have a longer [timeout](/docs/guide/timeouts).

In case the function takes more than 150 seconds to complete, a HTTP status 303
redirect response is returned pointing at the original URL with a special query
parameter linking it that request. This is the _result URL_ for your function.
Most web browsers allow for up to 20 such redirects, effectively allowing up to
50 minutes (20 \* 150 s) for web endpoints before the request times out.

(**Note:** This does not work with requests that require
[CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS), since the
response will not have been returned from your code in time for the server to
populate CORS headers.)

Some libraries and tools might require you to add a flag or option in order to
follow redirects automatically, e.g. `curl -L ...` or `http --follow ...`.

The _result URL_ can be reloaded without triggering a new request. It will block
until the request completes.

(**Note:** As of March 2025, the Python standard library's `urllib` module has the
maximum number of redirects to any single URL set to 4 by default ([source](https://github.com/python/cpython/blob/main/Lib/urllib/request.py)), which would limit the total timeout to 12.5 minutes (5 \* 150 s = 750 s) unless this setting is overridden.)

## Polling solutions

Sometimes it can be useful to be able to poll for results rather than wait for a
long running HTTP request. The easiest way to do this is to have your web
endpoint spawn a `modal.Function` call and return the function call id that
another endpoint can use to poll the submitted function's status. Here is an
example:

```python
import fastapi

import modal


image = modal.Image.debian_slim().pip_install("fastapi[standard]")
app = modal.App(image=image)

web_app = fastapi.FastAPI()


@app.function()
@modal.asgi_app()
def fastapi_app():
    return web_app


@app.function()
def slow_operation():
    ...


@web_app.post("/accept")
async def accept_job(request: fastapi.Request):
    call = slow_operation.spawn()
    return {"call_id": call.object_id}


@web_app.get("/result/{call_id}")
async def poll_results(call_id: str):
    function_call = modal.FunctionCall.from_id(call_id)
    try:
        return function_call.get(timeout=0)
    except TimeoutError:
        http_accepted_code = 202
        return fastapi.responses.JSONResponse({}, status_code=http_accepted_code)
```

[_Document OCR Web App_](/docs/examples/doc_ocr_webapp) is an example that uses
this pattern.
