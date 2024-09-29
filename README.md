# Prompt Tune

## 説明

プロンプトのチューニングを自動で行います。

## 準備

`.env.sapmle`を参考に`.env`ファイルを作成し、以下の内容を記述します。

```env
# OpenAIのAPIキー
OPENAI_API_KEY="xxxx"

# データベースファイルのパス
DATABASE_URL="file:./dev.db"

# チューニングを行うモデルの名前
SYSTEM_MODEL_NAME="gpt-4o-mini-2024-07-18"

# チューニング対象の（実際に利用する）モデルの名前
TUNING_MODEL_NAME="gpt-4o-mini-2024-07-18"
```

パッケージをインストールします。

```sh
npm install
```

DBを初期化します。

```sh
npx prisma migrate dev --name init
```

## 使い方

- システムプロンプトとユーザプロンプトを入力し、`Get Answer`ボタンをクリックすると、ユーザプロンプトに対する回答が表示されます。
- `Start Tuning`ボタンをクリックすると、新しいプロンプトとそれに対する回答が表示されます。
- 生成されたプロンプトを気に入った順に並び替え、ふさわしくないものを削除します。
- 追加の要望がある場合には`Additional Prompt`に入力します。
- `Next Generation`ボタンをクリックすると、次の世代のプロンプトとそれに対する回答が表示されます。
- `Regenerate`ボタンをクリックすると、以降の世代を削除し、新しいプロンプトとそれに対する回答が再生成されます。
- 新しくチューニングを始める際には、左メニューの`New Session`をクリックします。
