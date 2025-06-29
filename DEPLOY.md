# 🚀 SkyTracker デプロイガイド

## 無料デプロイオプション

### 1. GitHub Pages（推奨）✨
**完全無料、自動デプロイ**

#### 手順：
1. **GitHubリポジトリを作成**
   ```bash
   # GitHubで新しいリポジトリを作成後
   git remote add origin https://github.com/[username]/skytracker.git
   git branch -M main
   git push -u origin main
   ```

2. **GitHub Pages を有効化**
   - リポジトリの Settings → Pages
   - Source: "GitHub Actions" を選択
   - 自動的にデプロイが開始されます

3. **アクセス**
   - `https://[username].github.io/skytracker/`

#### 特徴：
- ✅ 完全無料
- ✅ 自動HTTPS
- ✅ カスタムドメイン対応
- ✅ 自動デプロイ

---

### 2. Netlify 🌐
**高機能、簡単デプロイ**

#### 手順：
1. **Netlifyアカウント作成**
   - https://netlify.com でサインアップ

2. **デプロイ方法A: ドラッグ&ドロップ**
   - プロジェクトフォルダをZIP化
   - Netlifyダッシュボードにドラッグ&ドロップ

3. **デプロイ方法B: Git連携**
   - "New site from Git" を選択
   - GitHubリポジトリを連携
   - 自動デプロイ設定

#### 特徴：
- ✅ 無料プラン充実
- ✅ 自動HTTPS
- ✅ フォーム処理
- ✅ エッジ関数対応

---

### 3. Vercel ⚡
**高速、開発者フレンドリー**

#### 手順：
1. **Vercelアカウント作成**
   - https://vercel.com でサインアップ

2. **デプロイ**
   ```bash
   npx vercel
   ```
   または
   - GitHubリポジトリをインポート

#### 特徴：
- ✅ 超高速CDN
- ✅ 自動HTTPS
- ✅ プレビューデプロイ
- ✅ 分析機能

---

### 4. Firebase Hosting 🔥
**Googleの高性能ホスティング**

#### 手順：
1. **Firebase CLI インストール**
   ```bash
   npm install -g firebase-tools
   ```

2. **プロジェクト初期化**
   ```bash
   firebase login
   firebase init hosting
   ```

3. **デプロイ**
   ```bash
   firebase deploy
   ```

#### 特徴：
- ✅ 高速CDN
- ✅ 自動HTTPS
- ✅ カスタムドメイン
- ✅ 分析機能

---

### 5. Surge.sh ⚡
**最速デプロイ**

#### 手順：
1. **Surge CLI インストール**
   ```bash
   npm install -g surge
   ```

2. **デプロイ**
   ```bash
   surge .
   ```

#### 特徴：
- ✅ 30秒でデプロイ
- ✅ カスタムドメイン
- ✅ 無料プラン

---

## 📱 PWA対応

全てのプラットフォームでPWA（Progressive Web App）として動作します：

### インストール方法：
1. **スマートフォン**
   - ブラウザメニュー → "ホーム画面に追加"

2. **デスクトップ**
   - ブラウザのアドレスバー → インストールアイコン

### PWA機能：
- ✅ オフライン動作
- ✅ プッシュ通知
- ✅ ネイティブアプリ風UI
- ✅ バックグラウンド同期

---

## 🔧 カスタムドメイン設定

### GitHub Pages:
1. リポジトリ Settings → Pages
2. Custom domain に独自ドメインを入力
3. DNS設定でCNAMEレコードを追加

### Netlify:
1. Site settings → Domain management
2. Add custom domain
3. DNS設定を更新

### Vercel:
1. Project Settings → Domains
2. Add domain
3. DNS設定を更新

---

## 📊 分析・監視

### Google Analytics 4:
```html
<!-- index.html の <head> に追加 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Lighthouse CI:
```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [push]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Audit URLs using Lighthouse
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            https://[your-domain]/
          uploadArtifacts: true
```

---

## 🚀 推奨デプロイフロー

### 開発 → 本番
1. **GitHub Pages**: 最も簡単、完全無料
2. **Netlify**: 高機能が必要な場合
3. **Vercel**: 最高のパフォーマンスが必要な場合

### 選択基準：
- **初心者**: GitHub Pages
- **高機能**: Netlify
- **高性能**: Vercel
- **Google連携**: Firebase

---

## 📞 サポート

デプロイで問題が発生した場合：
1. 各プラットフォームのドキュメントを確認
2. コミュニティフォーラムで質問
3. GitHub Issues で報告

**Happy Deploying! 🎉**