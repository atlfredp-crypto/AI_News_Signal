# Signal

AI関連の最新ニュースを集め、最大50本に圧縮して表示する速報アプリです。

- 公開RSS（Google ニュース、ITmedia AI+、Impress Watch、TechCrunch、The Verge、MIT News）と Hacker News から収集
- 抜粋のある記事を優先し、媒体の偏りを抑えて選定
- 記事ごとの要約、カテゴリ絞り込み、ブックマーク（この端末に保存）
- `XAI_API_KEY` がある場合、「日本語で要約」で Grok による日本語要約が使えます

## 起動

```bash
npm install
cp .env.example .env
npm run dev
```

開発サーバーは `http://localhost:8080` で起動します。

```bash
npm run typecheck
npm run build
```

## 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `XAI_API_KEY` | いいえ | xAI API キー。未設定でもニュース一覧は表示されます |

## スタック

TanStack Start / React / Vite / Tailwind CSS
