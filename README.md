# Signal

AI関連の最新ニュースを集め、最大50本に圧縮して表示する速報アプリです。

- 公開RSS（Google ニュース、ITmedia AI+、Impress Watch、TechCrunch、The Verge、MIT News）と Hacker News から収集
- 抜粋のある記事を優先し、媒体の偏りを抑えて選定
- 記事ごとの要約、カテゴリ絞り込み、ブックマーク（この端末に保存）
- `XAI_API_KEY` がある場合、「日本語で要約」で Grok による日本語要約が使えます（合言葉が必要）
- ホーム画面に追加して、アプリとして開けます（PWA）

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

## ホーム画面に追加

公開した URL をスマホのブラウザで開き、次の操作でアプリとして使えます。

- iPhone（Safari）: 共有 → ホーム画面に追加
- Android（Chrome）: メニュー → アプリをインストール / ホーム画面に追加

ブックマークは、その端末のブラウザ内に保存されます。

## 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `XAI_API_KEY` | いいえ | xAI API キー。未設定でもニュース一覧は表示されます |
| `SIGNAL_SUMMARY_PASSPHRASE` | 要約する場合は必要 | 要約ボタン用の合言葉。リポジトリには入れない |

## スタック

TanStack Start / React / Vite / Tailwind CSS
