# Dijital Performans Raporu

JSON verisinden, `top3`, `logo` ve `social-media` klasörlerindeki görselleri kullanarak tek sayfalık PDF raporu üretir.

## Klasör yapısı

```text
.
├── data.json
├── generate-report.js
├── logo/
│   └── logo.png
├── social-media/
│   ├── x.jpeg
│   ├── instagram.jpeg
│   ├── facebook.jpeg
│   └── youtube.jpeg
└── top3/
    ├── 1.jpeg
    ├── 2.jpeg
    └── 3.jpeg
```

- `top3/1.*`: 1. sıradaki kişinin görseli
- `top3/2.*`: 2. sıradaki kişinin görseli
- `top3/3.*`: 3. sıradaki kişinin görseli
- `logo/logo.*`: sağ üstte kullanılacak logo
- `social-media/x.*`, `instagram.*`, `facebook.*`, `youtube.*`: alttaki sosyal medya ikonları

Desteklenen görsel uzantıları: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`

## Kullanım

```bash
node generate-report.js
```

Farklı dosya veya klasörlerle:

```bash
node generate-report.js --data data.json --top3 top3 --logo logo --social social-media --output rapor.pdf
```

Yöntem ve kapsam metnini değiştirmek için:

```bash
node generate-report.js --method "DİDEK tarafından belirlenen listenin ilk 10 sonucu\nBu rapor {total} etkileşim verisiyle oluşturulmuştur."
```

`--method` içinde `{total}` yazarsan `--total` değeriyle değiştirilir. Satır kırmak için `\n` kullanabilirsin.

Sadece HTML önizleme üretmek için:

```bash
node generate-report.js --html-only
```
