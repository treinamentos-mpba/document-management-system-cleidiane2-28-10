# Especificação - Document Management System

## 1. Objetivo

Entregar uma aplicação web simples para que um usuário identifique seus documentos, envie arquivos, consulte os documentos registrados e baixe cada arquivo pelo identificador.

## 2. Escopo

### Dentro do escopo

- Enviar um arquivo e registrar seus metadados.
- Listar os documentos associados ao identificador de usuário informado.
- Baixar um documento pelo identificador, verificando a associação ao usuário informado.
- Armazenar o conteúdo dos arquivos no filesystem local da aplicação, em `backend/storage`, usando Multer com `diskStorage`.
- Manter os metadados em memória durante a execução do processo.
- Fornecer uma interface React para envio, listagem e download, integrada ao backend por `fetch`.

### Fora do escopo

- Armazenamento em nuvem, banco de dados ou provedores externos.
- Autenticação, autorização confiável, cadastro de usuários ou compartilhamento.
- Versionamento, edição, exclusão, pesquisa avançada ou pré-visualização de documentos.
- Persistência ou recuperação automática dos metadados após reiniciar o backend.

## 3. Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF-01 | O sistema deve aceitar o envio de um arquivo com o identificador `owner` do usuário. | Um envio válido responde `201 Created` com os metadados públicos do documento. |
| RF-02 | O sistema deve rejeitar um envio sem arquivo ou sem `owner` válido. | A resposta informa erro de requisição, sem registrar metadados; arquivo temporário, se criado, é removido. |
| RF-03 | O sistema deve persistir o conteúdo do arquivo no filesystem local em `backend/storage`. | Cada arquivo recebe um nome interno único, não derivado diretamente do nome fornecido pelo usuário. |
| RF-04 | O sistema deve listar documentos pertencentes ao `owner` informado. | A lista contém somente documentos associados ao identificador solicitado e retorna `200 OK`, inclusive quando vazia. |
| RF-05 | O sistema deve permitir o download por `id`, desde que o documento pertença ao `owner` informado. | O conteúdo é enviado como anexo com o nome original; documento inexistente ou de outro `owner` responde `404 Not Found`. |
| RF-06 | O sistema deve comunicar falhas de entrada, limite de arquivo e documento inexistente por respostas HTTP previsíveis. | A resposta de erro usa o formato definido nos contratos de API e não revela detalhes internos do filesystem. |
| RF-07 | A interface deve permitir enviar, visualizar a lista e iniciar o download dos documentos. | A interface usa os endpoints do backend pelo prefixo `/api` configurado no proxy do Vite. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | O conteúdo dos arquivos deve ser gravado somente no filesystem local da aplicação, em `backend/storage`, com Multer `diskStorage`; não usar serviços externos. |
| RNF-02 | Os metadados devem permanecer em memória nesta fase. Reiniciar o processo perde os registros, mesmo que os arquivos continuem no disco. |
| RNF-03 | Configurações de execução devem usar variáveis de ambiente quando aplicável, seguindo 12-Factor. `PORT` define a porta do backend. |
| RNF-04 | O tamanho máximo do arquivo deve ser limitado pelo Multer e configurável por `MAX_FILE_SIZE_BYTES`; o valor padrão inicial é 10 MiB. |
| RNF-05 | O nome original do arquivo deve ser tratado como dado não confiável: não pode determinar o caminho de gravação nem permitir traversal de diretório. |
| RNF-06 | As respostas não devem expor o nome interno de armazenamento, caminhos locais, stack traces ou outros detalhes internos. |
| RNF-07 | A API deve usar JSON para metadados e erros; o download deve responder com conteúdo binário e `Content-Disposition: attachment`. |
| RNF-08 | O backend deve ser testável pelo runner nativo `node:test`, sem exigir provedores externos. |

### Limites e validações

- O campo de arquivo do formulário multipart chama-se `file`.
- `owner` é uma string obrigatória, não vazia após `trim`.
- `MAX_FILE_SIZE_BYTES` deve ser um inteiro positivo; na ausência da variável, usar `10485760` bytes.
- Não há allowlist de extensões ou tipos MIME nesta fase. O MIME recebido pode ser registrado como metadado informativo, mas não é prova de segurança nem deve permitir execução do arquivo.
- O armazenamento usa um identificador interno único, por exemplo UUID, e nunca concatena o nome original a um caminho.

## 5. Modelo de dados

Os metadados são mantidos em memória, indexados pelo `id`. O campo `storedName` é interno ao repositório e nunca faz parte das respostas HTTP.

| Campo | Tipo | Exposição | Descrição |
| --- | --- | --- | --- |
| `id` | string (UUID) | Público | Identificador único do documento, gerado pelo backend. |
| `originalName` | string | Público | Nome original enviado pelo cliente; usado apenas para exibição e nome do download. |
| `size` | number (bytes) | Público | Tamanho do arquivo gravado. |
| `uploadedAt` | string (ISO 8601 UTC) | Público | Instante em que o upload foi registrado. |
| `owner` | string | Público | Identificador informado pelo cliente para associar o documento a um usuário. |
| `mimeType` | string | Público | Tipo informado pelo upload, apenas informativo. |
| `storedName` | string | Interno | Nome gerado pelo backend para localizar o arquivo dentro de `backend/storage`. |

O registro é removido da memória apenas quando o processo termina; exclusão de documento não faz parte deste escopo. A perda dos metadados no reinício pode deixar arquivos no diretório sem um registro correspondente, e não há recuperação automática nesta fase.

## 6. Contratos de API

### Convenções

- As rotas abaixo são montadas no backend sem o prefixo `/api`. O frontend usa `/api` e o proxy do Vite o remove durante o desenvolvimento.
- Metadados e erros usam `application/json; charset=utf-8`.
- Formato de erro:

```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Documento não encontrado."
  }
}
```

### `POST /upload`

- **Entrada:** `multipart/form-data` com `file` (arquivo obrigatório) e `owner` (texto obrigatório).
- **Sucesso:** `201 Created`, corpo JSON com os metadados públicos do documento (`id`, `originalName`, `size`, `uploadedAt`, `owner`, `mimeType`).
- **Erros:** `400 Bad Request` para arquivo ausente, `owner` ausente/inválido ou multipart inválido; `413 Payload Too Large` quando exceder `MAX_FILE_SIZE_BYTES`; `500 Internal Server Error` para falha inesperada de gravação.
- Uma falha após a gravação do arquivo deve tentar remover o arquivo que não chegou a ser registrado.

### `GET /documents?owner={owner}`

- **Entrada:** parâmetro de query `owner`, obrigatório e não vazio.
- **Sucesso:** `200 OK`, com os documentos do usuário ordenados por `uploadedAt` decrescente:

```json
{
  "documents": [
    {
      "id": "uuid",
      "originalName": "relatorio.pdf",
      "size": 2048,
      "uploadedAt": "2026-10-28T12:00:00.000Z",
      "owner": "usuario-123",
      "mimeType": "application/pdf"
    }
  ]
}
```

- Lista vazia retorna `200 OK` com `"documents": []`.
- **Erro:** `400 Bad Request` se `owner` estiver ausente ou vazio.

### `GET /documents/:id/download?owner={owner}`

- **Entrada:** identificador do documento no caminho e `owner` obrigatório na query.
- **Sucesso:** `200 OK`, conteúdo binário com `Content-Type` do registro (ou `application/octet-stream` se indisponível) e `Content-Disposition: attachment` com o nome original devidamente codificado.
- **Erros:** `400 Bad Request` se `id` ou `owner` for inválido/ausente; `404 Not Found` se o documento não existir, não pertencer ao `owner` ou o arquivo não estiver disponível; `500 Internal Server Error` para outra falha de leitura.
- Responder `404` também para documento de outro `owner` evita revelar sua existência.

### Erros padronizados

| HTTP | `code` | Situação |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Campo obrigatório ausente, valor inválido ou multipart malformado. |
| 404 | `DOCUMENT_NOT_FOUND` | Documento inexistente, fora do `owner` solicitado ou arquivo ausente. |
| 413 | `FILE_TOO_LARGE` | Arquivo acima de `MAX_FILE_SIZE_BYTES`. |
| 500 | `INTERNAL_ERROR` | Falha inesperada; não incluir detalhes internos na resposta. |

## 7. Decisões arquiteturais

### Backend

- Manter CommonJS e Express.
- Respeitar o fluxo `routes → controllers → services → repositories`.
- `routes/` declara caminhos e encaminha requisições; `controllers/` valida entrada HTTP e formata respostas; `services/` aplica as regras de upload, consulta e download; `repositories/` mantém metadados em memória e acessa os arquivos locais.
- Multer com `diskStorage` grava exclusivamente em `backend/storage`. A configuração de destino e o nome interno não devem depender de dados de caminho enviados pelo cliente.
- O serviço coordena a gravação e o registro de metadados. Se o registro falhar após gravar, tenta remover o arquivo recém-criado.
- As camadas internas não dependem de Express nem conhecem detalhes da interface.

### Frontend

- React funcional com Hooks e organização existente em `components/`, `pages/` e `services/`.
- A comunicação HTTP usa `fetch` pelo prefixo `/api`; o proxy de desenvolvimento encaminha ao backend local.
- A interface não é fonte confiável de `owner`, validação ou autorização.

### Identidade e segurança

Este escopo não possui autenticação. `owner` é um identificador fornecido pelo cliente e serve somente para organização lógica dos registros; não comprova identidade e não é uma fronteira de segurança. A verificação de propriedade no endpoint de download previne acesso acidental pela API, mas não impede que um cliente escolha o identificador de outra pessoa. Autenticação e autorização reais exigem uma decisão de produto e ficam fora desta especificação.

## 8. Plano de execução

As etapas abaixo descrevem uma implementação futura. Nesta entrega, somente este documento de especificação deve ser criado; não implementar nem alterar arquivos de backend ou frontend.

1. **Fundação do backend:** definir armazenamento local, configuração de limite, estrutura de metadados em memória e tratamento comum de erros, preservando a divisão de camadas.
2. **Upload:** implementar rota, controller, serviço e repositório para validação, `diskStorage`, geração de identificador/nome interno e registro dos metadados.
3. **Consulta e download:** implementar listagem filtrada por `owner` e download por `id`, verificando a associação e tratando arquivo ausente.
4. **Testes do backend:** cobrir contratos HTTP, isolamento lógico por `owner`, limites de upload, erros e limpeza em falhas, usando armazenamento temporário/local controlado pelos testes.
5. **Interface React:** implementar os fluxos de envio, listagem, estados de carregamento/erro/vazio e download, mantendo chamadas em `services/` e componentes reutilizáveis.
6. **Integração e validação:** verificar proxy `/api`, executar testes do backend e build do frontend, e revisar o fluxo completo de upload, listagem e download.

## 9. Critérios gerais de aceite

- Os requisitos RF-01 a RF-07 são demonstráveis pelos contratos e testes correspondentes.
- Arquivos são gravados somente em `backend/storage` via Multer `diskStorage`; nenhum serviço de armazenamento externo é introduzido.
- Os metadados permanecem em memória e as consequências do reinício estão documentadas.
- As dependências seguem a direção `routes → controllers → services → repositories`.
- O endpoint de download não entrega documentos que não correspondam ao `owner` enviado e não revela se pertencem a outra identidade.
- Nesta etapa de especificação, a única alteração é `docs/specs/dms-spec.md`.