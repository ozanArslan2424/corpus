---
toc:
  - title: Properties
    url: "#properties"
---

# HeaderKey

Just some common headers. See [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers) for the full spec.

## Properties

### CacheControl

Controls caching mechanisms for requests and responses.

### ContentType

Specifies the media type of the resource or data.

### ContentLength

Indicates the size of the entity-body in bytes.

### ContentDisposition

Whether to display payload inline within the page or prompt the user to download it as an attachment.

### AcceptEncoding

Specifies the character encodings that are acceptable.

### Accept

Informs the server about the types of data that can be sent back.

### Authorization

Contains the credentials to authenticate with the server.

### UserAgent

The user agent string of the client software.

### Host

The domain name of the server and port number.

### Referer

The address of the previous web page from which the current request originated.

### Connection

Indicates whether the connection should be kept alive.

### Upgrade

Requests that the server switch to a different protocol (e.g. WebSocket).

### Pragma

Used to specify directives that must be obeyed by caching mechanisms.

### Date

The date and time at which the message was sent.

### IfNoneMatch

Makes the request conditional based on the ETag of the resource.

### IfModifiedSince

Makes the request conditional based on the last modification date.

### ETag

An identifier for a specific version of a resource.

### Expires

The date and time after which the response is considered stale.

### LastModified

The last modification date of the resource.

### Location

Indicates the URL to redirect a page to.

### WWWAuthenticate

Defines the authentication method that should be used.

### AccessControlMaxAge

Determines how long the results of a preflight request can be cached.

### AccessControlAllowCredentials

Indicates whether the response can be shared with resources with credentials.

### AccessControlRequestMethod

Indicates which HTTP method will be used in the actual CORS request.

### AccessControlExposeHeaders

Indicates which headers can be exposed to the browser in a CORS response.

### AccessControlAllowOrigin

Indicates which origins are allowed to access the resource.

### AccessControlAllowMethods

Specifies the HTTP methods allowed when accessing the resource in a CORS request.

### AccessControlAllowHeaders

Specifies the HTTP headers allowed in a CORS request.

### SetCookie

Sends cookies from the server to the client.

### Cookie

Sends cookies from the client to the server.

### Vary

Determines which headers should be used to select a response from cache when content negotiation is in use.
