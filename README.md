# Torres Madeira Notifica

Sistema interno em tempo real para comunicação entre **Vendedores** e **Estoque**, construído como uma Progressive Web App (PWA) moderna.

## 🚀 Tecnologias

- **Framework**: Next.js 14 (App Router)
- **Estilização**: Tailwind CSS + shadcn/ui (Lucide-React, Sonner)
- **Banco de Dados & Realtime**: Supabase
- **Funcionalidades Nativas**: Registrado como PWA (Manifest & offline placeholders)
- **Push Notifications**: Firebase Cloud Messaging (Web Push + Admin SDK)

---

## 🔧 Configuração e Deploy

Para o sistema funcionar corretamente em produção, siga os passos de configuração dos dois serviços abaixo e adicione as chaves no Vercel no momento do deploy.

### 1. Criar e Configurar o Supabase

1. Crie um projeto no [Supabase](https://database.new/).
2. Vá até o **SQL Editor** no painel esquerdo do projeto.
3. Copie o conteúdo do arquivo localizado na raiz deste projeto chamado `supabase.sql` e execute-o. Isso irá criar as tabelas `sales` e `device_tokens`, habilitar o RLS de segurança passiva e ligar a API Realtime para as vendas.
4. Anote a sua `Project URL` e a `anon public API key` (ficam nas opções de _Project Settings -> API_).
   - Elas serão as variáveis:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Criar e Configurar o Firebase (Push Notifications)

Para que o celular do estoque receba mensagens pop-up, configuramos o Firebase Cloud Messaging.

1. Crie um projeto em [Firebase Console](https://console.firebase.google.com/).
2. Adicione um "Web App" (ícone de código `</>`). Registre e copie o objeto `firebaseConfig`.
3. No painel de controle (Canto superior esquerdo - engrenagem) vá em **Project Settings -> Cloud Messaging**.
4. Desça até a opção **Web configuration** e crie um "Key pair (VAPID key)". Você precisará dessa chave.
5. Volte em **Project Settings -> Service accounts**, selecione "Node.js" e clique em **Generate new private key**. O Firebase fará download de um arquivo JSON. Você precisará dessas credenciais de serviço.

Adicione essas variáveis como Secrets:
- `NEXT_PUBLIC_FIREBASE_API_KEY` (do seu Web App Config)
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (do JSON ou Projeto)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (a chave VAPID Key para registro)
- `FIREBASE_CLIENT_EMAIL` (campo `client_email` dentro do seu JSON de admin baixado)
- `FIREBASE_PRIVATE_KEY` (campo `private_key` do seu JSON - **Importante:** use aspas duplas se for testar no `.env.local` e certifique-se de manter os `/n`).

### 3. Executando Localmente

Baixe as dependências:
```bash
npm install
```

Crie o arquivo baseado no exemplo:
```bash
cp .env.example .env.local
```

Preencha as variáveis e rode:
```bash
npm run dev
```

### 4. Publicando no Vercel (Production Deploy)

1. Faça o envio (Push) deste repositório para o GitHub.
2. Acesse a [Vercel](https://vercel.com/) e clique em **Add New -> Project**.
3. Importe seu repositório do GitHub.
4. Na tela de "Configure Project", vá na seção **Environment Variables** e adicione TODAS as configurações do `.env.example` preenchidas usando os dados do Supabase e Firebase.
5. Clique em **Deploy**.

> **Nota sobre `.env`**: Na Vercel, a `FIREBASE_PRIVATE_KEY` deve ser colada com as quebras de linha exatas (ou preservando os `\n`). O script em `lib/firebase-admin.ts` já se encarrega de formatar do modo correto.

---

## 📱 Utilização Diária (Padrão PWA)

1. **Celular do Estoque**: Abra a URl do projeto pelo Safari ou Chrome do celular da equipe de estoque.
2. Adicione à tela inicial (Add to Home Screen) para transformar um aplicativo nativo isolado.
3. No PWA aberto do estoque, clique em **"Receber Notificações"** e ACEITE a permissão nativa. A tela já começará a piscar e tocar som automaticamente nas novas vendas criadas pela parte da Venda.
4. **Desktop / Tablet de Vendas**: Basta acessar a raiz da página e registrar as madeiras, comprimentos e as quantidades. O painel cuidará de acionar os envios push para os dispositivos de estoque cadastrados.
