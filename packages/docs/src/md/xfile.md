# XFile

`XFile` is a lightweight wrapper around Bun's native `BunFile` that adds commonly needed utilities: path parsing, MIME detection, directory-aware writes, copy/move, and more — without pulling in any dependencies.

The underlying `BunFile` instance is always accessible via `file.bunFile` if you need to drop down to the native API.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Constructor](#constructor)
3. [Properties](#properties)
4. [Methods](#methods)

</section>

## Usage

### Basic operations

```ts
import { X } from "@ozanarslan/corpus";

const file = new X.File("assets/document.txt");

if (await file.exists()) {
	const content = await file.text();
	console.log(content);
}
```

### Constructing from a BunFile

```ts
const file = new X.File(Bun.file("assets/document.txt"));
// file.bunFile === the BunFile you passed in
```

### Writing files

```ts
const file = new X.File("output/report.txt");
await file.write("Generated at " + new Date().toISOString());

// Parent directories are created automatically
const nested = new X.File("output/2024/q4/summary.txt");
await nested.write("Quarterly summary");
```

### Derived paths

```ts
const file = new X.File("assets/photo.jpg");

file.sibling("thumb.webp"); // assets/thumb.webp
file.withExtension("webp"); // assets/photo.webp
file.dir; // "assets"
```

### MIME type detection

MIME type is delegated to `BunFile.type`, so it covers every format Bun knows about — no manual map to maintain.

```ts
new X.File("styles/main.css").mimeType; // "text/css"
new X.File("photo.webp").mimeType; // "image/webp"
new X.File("photo.WEBP").mimeType; // "image/webp" (normalized)

// Fallback extension for extension-less paths
new X.File("data", "json").mimeType; // "application/json"
```

## Constructor

```ts
new X.File(pathOrBunFile: string | Bun.BunFile, fallbackExtension?: string)
```

| Parameter           | Type                    | Default | Description                                                       |
| ------------------- | ----------------------- | ------- | ----------------------------------------------------------------- |
| `pathOrBunFile`     | `string \| Bun.BunFile` | —       | File path string or an existing `BunFile` instance.               |
| `fallbackExtension` | `string`                | `"txt"` | Extension used for MIME detection when the path has no extension. |

## Properties

| Property     | Type          | Description                                                              |
| ------------ | ------------- | ------------------------------------------------------------------------ |
| `path`       | `string`      | The resolved file path.                                                  |
| `bunFile`    | `Bun.BunFile` | The underlying `BunFile` instance.                                       |
| `name`       | `string`      | Filename without the extension.                                          |
| `fullname`   | `string`      | Filename including the extension.                                        |
| `extension`  | `string`      | Lowercase file extension, excluding the leading dot.                     |
| `dir`        | `string`      | Absolute path of the containing directory.                               |
| `mimeType`   | `string`      | MIME type from `BunFile.type`, falls back to `application/octet-stream`. |
| `parentDirs` | `string[]`    | Parent directory names ordered from immediate parent to root.            |

## Methods

### exists

`exists(): Promise<boolean>`

Delegates to `BunFile.exists()`.

```ts
await new X.File("assets/data.json").exists(); // true | false
```

### text

`text(encoding?): Promise<string>`

Reads the file as a string. Delegates to `BunFile.text()` for UTF-8, falls back to `fs.readFile` for other encodings.

```ts
await new X.File("assets/template.html").text(); // utf-8
await new X.File("legacy/data.txt").text("latin1"); // other encodings
```

### bytes

`bytes(): Promise<Uint8Array>`

Reads the file as raw bytes. Delegates to `BunFile.bytes()`.

```ts
const bytes = await new X.File("assets/image.png").bytes();
```

### stream

`stream(): Promise<ReadableStream<Uint8Array>>`

Returns a readable stream. Delegates to `BunFile.stream()`.

```ts
const stream = await new X.File("assets/video.mp4").stream();
```

### write

`write(data): Promise<void>`

Writes data to the file via `Bun.write()`, overwriting any existing content. Parent directories are created automatically.

```ts
await new X.File("output/log.txt").write("entry");
await new X.File("output/data.bin").write(new Uint8Array([0xde, 0xad]));
```

### append

`append(data): Promise<void>`

Appends data to the file without overwriting existing content.

```ts
const log = new X.File("output/log.txt");
await log.append("\nnew entry");
```

### unlink

`unlink(): Promise<void>`

Deletes the file. Delegates to `BunFile.unlink()`. Throws if the file does not exist.

```ts
const file = new X.File("tmp/cache.json");
if (await file.exists()) await file.unlink();
```

### stat

`stat(): Promise<Stats>`

Returns `fs.Stats` for the file — size, timestamps, permissions, etc.

```ts
const s = await new X.File("assets/image.png").stat();
console.log(s.size, s.mtime);
```

### size

`size(): Promise<number | null>`

Returns the file size in bytes, or `null` if the file does not exist. Reads from `BunFile.size` directly — no `stat` call.

```ts
await new X.File("assets/image.png").size(); // 204800 | null
```

### copyTo

`copyTo(dest: string): Promise<XFile>`

Copies the file to `dest`, creating parent directories automatically. Returns a new `XFile` pointing to the destination.

```ts
const copy = await new X.File("src/logo.png").copyTo("dist/logo.png");
```

### moveTo

`moveTo(dest: string): Promise<XFile>`

Moves (renames) the file to `dest`, creating parent directories automatically. Returns a new `XFile` pointing to the destination.

```ts
const moved = await new X.File("tmp/upload.png").moveTo("assets/upload.png");
```

### sibling

`sibling(filename: string): XFile`

Returns a new `XFile` in the same directory with a different filename.

```ts
new X.File("assets/photo.jpg").sibling("thumb.webp");
// → XFile { path: "assets/thumb.webp" }
```

### withExtension

`withExtension(ext: string): XFile`

Returns a new `XFile` with the same name but a different extension.

```ts
new X.File("assets/photo.jpg").withExtension("webp");
// → XFile { path: "assets/photo.webp" }
```
