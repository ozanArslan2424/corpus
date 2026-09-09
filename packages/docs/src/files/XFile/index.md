# XFile

File handling for the routes that serve files.

`XFile` wraps a path with the reads, writes and path manipulation the
framework needs, so `FileRoute`, `StaticRoute`,
`BundleRoute` and [Res.file](../Res/index.md#res-file) all go through one place instead of
each reaching for `fs` and `path` themselves.

It sits on both Bun's file API and Node's `fs`, choosing per operation: Bun's
for streaming, Node's for everything where Bun's caching would give a stale
answer.

<section class="table-of-contents">

##### Contents

1. [XFile](#xfile)

</section>

## XFile

_class_

```ts
class XFile
```

A file at a path.

The path is the only state; nothing is read at construction, so an XFile
doesn't officially exist (get it?) and can be written from scratch.
The path-manipulation members — [XFile.name](#xfile-name), [XFile.extension](#xfile-extension),
[XFile.sibling](#xfile-sibling) — are pure string work and never touch the disk.

Reads are synchronous. The routes that use it read either once at startup or
per request from the OS page cache, so the simpler API is worth more than the
async one.

### XFile.constructor()

```ts
constructor(/** The path of the file or BunFile directly. */ pathOrBunFile: string | Bun.BunFile, /** Fallback extension for extension-less files, defaults to "txt" */ private readonly fallbackExtension: string = "txt", )
```

Creates a file handle. Nothing is read or checked until an operation asks
for it.

**Parameters**

- `pathOrBunFile` — The path of the file or BunFile directly.
- `fallbackExtension` — Fallback extension for extension-less files, defaults to "txt". It decides what [XFile.mimeType](#xfile-mimetype) reports for a file whose name carries no extension.

### XFile.bunFile

```ts
readonly bunFile: Bun.BunFile
```

The underlying Bun file, used for streaming.

### XFile.path

```ts
readonly path: string
```

The path this handle points at, as given.

### XFile.text()

```ts
text(encoding: BufferEncoding = "utf8"): string
```

Reads the file content and returns it as a string.

**Parameters**

- `encoding` — defaults to "utf8"

**Returns** — The decoded contents.

**Throws** — `Error` when the file does not exist.

### XFile.stream()

```ts
stream(): ReadableStream<Uint8Array>
```

Opens a readable stream to the file's content.

**Returns** — The stream. This is what the file-serving routes return for large bodies, so nothing is buffered in memory.

### XFile.exists()

```ts
exists(): boolean
```

Checks if the file exists in the file system.

Deliberately uses Node's `fs` rather than Bun's: `Bun.file().exists()`
caches, and this handle's `BunFile` was created before the file may have
been deleted, so it would report a stale answer.

**Returns** — `true` when the file exists right now.

### XFile.write()

```ts
write(data: string | ArrayBuffer | Uint8Array): void
```

Writes to the file, directories are created recursively.

**Parameters**

- `data` — The contents to write, replacing anything already there.

### XFile.unlink()

```ts
unlink(): void
```

Deletes the file.

**Throws** — `Error` when the file does not exist.

### XFile.bytes()

```ts
bytes(): Buffer<ArrayBuffer>
```

Reads the file content and returns it as a Uint8Array.

**Returns** — The raw bytes. Used where an exact `Content-Length` is wanted; see [XFile.stream](#xfile-stream) for the alternative.

**Throws** — `Error` when the file does not exist.

### XFile.stat()

```ts
stat(): fs.Stats
```

Returns file metadata (size, dates, etc.)

**Returns** — The stats.

**Throws** — `Error` when the file does not exist.

### XFile.size()

```ts
size(): number | null
```

Returns the file size in bytes, or null if the file doesn't exist. Unlike
[XFile.stat](#xfile-stat), a missing file is not an error here.

**Returns** — The size in bytes, or `null`.

### XFile.copyTo()

```ts
copyTo(dest: string): XFile
```

Copies the file to a destination path, creating directories recursively.

**Parameters**

- `dest` — Where to copy it.

**Returns** — A handle to the copy, carrying this handle's fallback extension.

### XFile.moveTo()

```ts
moveTo(dest: string): XFile
```

Moves (renames) the file to a destination path, creating directories recursively.

**Parameters**

- `dest` — Where to move it.

**Returns** — A handle to the new location. This handle still points at the old path, which no longer exists.

### XFile.append()

```ts
append(data: string | Uint8Array): void
```

Appends data to the file.

**Parameters**

- `data` — The contents to add at the end. Unlike [XFile.write](#xfile-write), parent directories are not created.

### XFile.sibling()

```ts
sibling(filename: string): XFile
```

Returns a new XFile pointing to a sibling path (same directory, different name).

**Parameters**

- `filename` — The sibling's full name, extension included.

**Returns** — A handle to the sibling. Nothing is created on disk.

### XFile.withExtension()

```ts
withExtension(ext: string): XFile
```

Returns a new XFile with a different extension.

**Parameters**

- `ext` — The new extension, without the leading dot.

**Returns** — A handle to the renamed path. Nothing is moved on disk.

### XFile.dir

```ts
get dir(): string
```

The absolute directory path containing this file.

**Returns** — The directory path.

### XFile.name

```ts
get name(): string
```

The name of the file without the extension.

**Returns** — The bare name.

### XFile.extension

```ts
get extension(): string
```

The file extension (e.g., "html", "md"), excluding the leading dot.

**Returns** — The lowercased extension, or the fallback extension when the name has none.

### XFile.fullname

```ts
get fullname(): string
```

The full name of the file, including the extension.

**Returns** — The name with its extension. This is what the file-serving routes send as the `Content-Disposition` filename.

### XFile.parentDirs

```ts
get parentDirs(): string[]
```

Gets the parent directory names as an array, ordered from the immediate parent up to the root.

**Returns** — The directory names, nearest first. Empty segments are dropped, so a leading or doubled separator does not produce blanks.

### XFile.mimeType

```ts
get mimeType(): string
```

The standard MIME type associated with the file's extension.

Resolved from the extension alone — the file's contents are never read, and
it need not exist. Any parameters such as `charset` are stripped, so the
result is safe to use as a bare `Content-Type`.

**Returns** — The MIME type, or `"application/octet-stream"` when the extension maps to nothing known.
