# Sistema de Fila Hospitalar com Classificação de Risco

Programa em Python que organiza o atendimento de um pronto-socorro.
Classifica cada paciente por gravidade a partir dos sinais vitais e monta a
fila de chamada de modo que o mais grave seja atendido primeiro — sem que
ninguém perca a vez para quem chegou depois dentro do mesmo nível de risco. É
o tipo de controle que sistemas de triagem hospitalar fazem para decidir quem
entra no consultório a seguir.

---

## 📋 O problema

Um pronto-socorro não pode atender na simples ordem de chegada. Quem sofreu um
infarto e chegou agora precisa ser visto antes de quem espera há uma hora com
dor de garganta.

Por outro lado, também não basta ordenar só por gravidade: entre dois pacientes
igualmente graves, quem chegou primeiro não pode perder a vez para quem acabou
de entrar.

O sistema precisa então respeitar **duas regras ao mesmo tempo**:

| Situação | Quem é chamado primeiro |
|---|---|
| Vermelho chegou às 10h, azul chegou às 8h | ✅ O vermelho — gravidade vence |
| Dois amarelos, um chegou às 8h e outro às 9h | ✅ O das 8h — ordem de chegada vence |
| Laranja chegou agora, amarelo espera há 2 horas | ✅ O laranja — é mais grave |

Resumindo a regra do protocolo:

> Entre níveis diferentes, vence a **gravidade**.
> Dentro do mesmo nível, vence quem **chegou primeiro**.

## 🧠 Solução

O problema é resolvido com o **TAD Fila (Queue)** — estrutura de dados FIFO
(*First In, First Out*, "primeiro a entrar, primeiro a sair") — organizada como
uma **fila de prioridade por baldes**. A lógica é:

1. Ao ser admitido, o paciente tem os sinais vitais avaliados e recebe um
   **nível de risco de 1 a 5** (vermelho, laranja, amarelo, verde ou azul).
2. Existe **uma fila FIFO para cada nível** de risco. O paciente é enfileirado
   no balde correspondente ao seu nível, sem precisar ser comparado com
   ninguém.
3. Ao chamar o próximo, o programa percorre os baldes **do mais grave para o
   menos grave** e desenfileira o primeiro paciente do primeiro balde não
   vazio.
4. Como cada balde é uma fila FIFO, dentro de um mesmo nível o atendimento
   respeita a ordem de chegada.

```
VERMELHO  →  [ FIFO ]   ← varre daqui
LARANJA   →  [ FIFO ]
AMARELO   →  [ FIFO ]
VERDE     →  [ FIFO ]
AZUL      →  [ FIFO ]   ← ... até aqui
```

A Fila é a estrutura ideal aqui porque o problema exige atender **na ordem em
que os pacientes chegaram** — exatamente o comportamento FIFO. A divisão em
baldes, por sua vez, garante que a gravidade tenha precedência entre níveis
diferentes sem quebrar a ordem de chegada dentro de cada nível.

### A classificação de risco

Cada sinal vital é avaliado isoladamente, e o nível final é o **mais grave**
entre eles — um único sinal crítico já basta para classificar o paciente como
emergência.

| Sinal vital | Critério para os níveis mais graves |
|---|---|
| Frequência cardíaca | acima de 150 ou abaixo de 40 bpm → vermelho |
| Saturação de oxigênio | abaixo de 85% → vermelho |
| Temperatura | 39,5 °C ou mais, ou 35 °C ou menos → vermelho |
| Dor referida | 9 ou 10 na escala → laranja |

## 🚀 Como executar

Requer apenas **Python 3** (nenhuma biblioteca externa é necessária).

```bash
python fila_hospitalar.py
```

O programa entra em modo interativo:

```
=======================================
   SISTEMA DE FILA HOSPITALAR
=======================================
Autor: Gabriel Roberto Marinho Da Silva Reis
Data: 22/09/2026
...
=======================================

=======================================
 1 - Admitir paciente
 2 - Chamar proximo
 3 - Listar ordem de atendimento
 4 - Resumo por nivel de risco
 0 - Sair
=======================================
Opcao: 1

--- ADMISSAO DE PACIENTE ---
Nome do paciente: Diego Almeida
Sinais vitais:
  Frequencia cardiaca (20 a 250 bpm): 168
  Saturacao de oxigenio (50 a 100 %): 84
  Temperatura (30.0 a 43.0 C): 39.6
  Dor referida (0 a 10): 9

  Senha: 2
  Classificacao de risco: VERMELHO
  Tempo maximo de espera: 0 minutos
```

A opção 3 mostra a ordem real de chamada:

```
--- ORDEM DE ATENDIMENTO ---
  +-------+-------+----------------------+-----------+
  | ordem | senha | nome                 | risco     |
  +-------+-------+----------------------+-----------+
  |     1 |     2 | Diego Almeida        | VERMELHO  |
  |     2 |     3 | Bruno Carvalho       | AMARELO   |
  |     3 |     4 | Carla Menezes        | AMARELO   |
  |     4 |     1 | Ana Ribeiro          | AZUL      |
  +-------+-------+----------------------+-----------+
  Total aguardando: 4
```

Repare nas duas regras funcionando juntas: Diego recebeu a senha 2 (chegou em
segundo) e é chamado primeiro, porque é o mais grave. Já Bruno vem antes de
Carla — os dois são amarelos, e Bruno chegou antes.

## 🌐 Versão web

Além do programa de terminal, o projeto tem duas páginas web com a mesma
lógica, escritas em HTML e JavaScript puros (sem servidor e sem instalação).
Basta abrir o arquivo no navegador.

| Página | O que faz |
|---|---|
| `web/fila-hospitalar.html` | Painel do pronto-socorro: admitir paciente, chamar o próximo, ver a ordem de atendimento com o tempo de espera e os 5 baldes FIFO desenhados na tela |
| `web/triagem.html` | Triagem de um paciente por vez: identificação, queixa, sinais vitais e sinais de alerta, gerando a ficha com a cor de risco e o histórico de triagens |

As classes `Fila` e `FilaDePrioridade` e a função de classificação de risco
são uma tradução direta do código Python. A tela de triagem acrescenta
**sinais de alerta** (por exemplo, dor no peito ou falta de ar intensa), que
podem elevar a cor mesmo com os sinais vitais normais. Esses critérios são
simplificados e têm uso apenas educacional.

Os dados ficam salvos no navegador de quem está usando (`localStorage`).

## 📁 Estrutura do projeto

```
.
├── fila_hospitalar.py        # Código-fonte principal (terminal)
├── web/
│   ├── fila-hospitalar.html  # Versão web da fila de atendimento
│   └── triagem.html          # Tela de triagem básica
└── README.md                 # Este arquivo
```

## 🛠️ Detalhes técnicos

**Estrutura de dados:** Fila (`Fila`), implementada com lista Python e
capacidade máxima configurável, combinada numa fila de prioridade
(`FilaDePrioridade`) de cinco baldes — um por nível de risco.

**Complexidade de tempo:**

| Operação | Custo | Por quê |
|---|---|---|
| Admitir paciente | O(1) | enfileira direto no balde do nível, sem comparar com ninguém |
| Chamar próximo | O(1) | varre no máximo 5 baldes, que é constante |
| Listar a fila | O(n) | visita cada paciente uma vez |

**Complexidade de espaço:** O(n), onde n é a quantidade de pacientes
aguardando.

**Por que baldes e não um heap binário.** Um heap resolveria a prioridade em
O(log n), mas **não é estável**: dois pacientes amarelos poderiam ser chamados
fora da ordem em que chegaram. Alguém que esperou duas horas veria outro de
mesma gravidade passar na frente — injusto e inaceitável num pronto-socorro.
Como os níveis de risco são apenas cinco e conhecidos de antemão, os baldes
FIFO são mais rápidos, mais simples e garantem a estabilidade de graça.

**Índice zero não utilizado.** A lista de baldes tem seis posições, mas a
posição 0 é deixada vazia de propósito, para que o índice do balde coincida com
o número do nível de risco. Assim `baldes[5]` é o balde vermelho, sem precisar
de aritmética de conversão espalhada pelo código.

**Validação de entrada.** As funções `ler_inteiro` e `ler_decimal` insistem até
receber um valor válido dentro da faixa, em vez de deixar o programa quebrar
com uma exceção. Nome vazio cancela a admissão, e opção inválida no menu apenas
avisa e volta.

## ✍️ Autor

**Gabriel Roberto Marinho Da Silva Reis**

## 📄 Licença

Este projeto está disponível para uso livre e educacional.
