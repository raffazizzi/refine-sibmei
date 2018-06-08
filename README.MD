# Refine SibMei

Automatically clean up and refine MEI files exported from *Sibelius* using the [Sibelius MEI Plugin](https://github.com/music-encoding/sibmei) v.2.1.0.

* remove unnecessary non-breaking space that create issues in some text editors
* switch XML declaration from UTF-16 to UTF-8
* (optional and experimental) optimize slurs for Verovio rendering (attempt to resolve time stamps to event ids)

## Usage

Use online at https://raffazizzi.github.io/refine-sibmei.

## Offline usage

Clone or download this repository and install nodeJS. Then:

```
npm install
npm start
```

Visit http://localhost:8888 to use *Refine SibMei*.

## Development 

See Offline usage

## Building

```
npm install
npm run build
```