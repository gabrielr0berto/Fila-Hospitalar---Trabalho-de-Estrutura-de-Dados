"""
================================================================
SISTEMA DE FILA HOSPITALAR COM CLASSIFICACAO DE RISCO
================================================================

Autor do software: Gabriel Roberto Marinho Da Silva Reis

PROBLEMA:
Um pronto-socorro nao pode atender os pacientes na simples
ordem de chegada. Quem sofreu um infarto e chegou agora
precisa ser visto antes de quem espera ha uma hora com dor
de garganta. Por outro lado, tambem nao basta ordenar apenas
por gravidade: entre dois pacientes igualmente graves, quem
chegou primeiro nao pode perder a vez para quem acabou de
entrar. O sistema precisa entao responder a duas perguntas
ao mesmo tempo -- qual e a ordem de chegada dos pacientes e
qual e a ordem em que eles devem ser chamados -- mantendo as
duas coerentes entre si.

SOLUCAO:
O problema foi resolvido utilizando o TAD Fila (estrutura
FIFO - First In, First Out - "primeiro a entrar, primeiro a
sair"), implementada com lista (equivalente ao array do C),
combinada numa FILA DE PRIORIDADE POR BALDES. A logica
funciona da seguinte forma:

  1. Ao ser admitido, o paciente tem os sinais vitais
     avaliados e recebe um NIVEL DE RISCO de 1 a 5
     (vermelho, laranja, amarelo, verde ou azul).
  2. Existe UMA FILA FIFO PARA CADA NIVEL de risco. O
     paciente e enfileirado no balde correspondente ao seu
     nivel, sem precisar ser comparado com ninguem.
  3. Ao chamar o proximo, o programa percorre os baldes do
     mais grave para o menos grave e desenfileira o primeiro
     paciente do primeiro balde nao vazio.
  4. Como cada balde e uma fila FIFO, dentro de um mesmo
     nivel o atendimento respeita a ordem de chegada.

A escolha da Fila se justifica porque o problema exige
atender na ordem em que os pacientes chegaram -- exatamente
o comportamento FIFO da estrutura. A divisao em baldes, por
sua vez, garante que a gravidade tenha precedencia entre
niveis diferentes sem quebrar a ordem de chegada dentro de
cada nivel.
================================================================
"""

CAPACIDADE = 100

NIVEIS = 5

# Nome e tempo maximo de espera (em minutos) de cada nivel de risco,
# conforme o protocolo de triagem adotado.
NOMES_RISCO = {5: "VERMELHO", 4: "LARANJA", 3: "AMARELO",
               2: "VERDE", 1: "AZUL"}

TEMPO_MAXIMO = {5: 0, 4: 10, 3: 60, 2: 120, 1: 240}


# ---------- TAD Fila (lista, com limite de capacidade) ----------


class Fila:
    """Fila de pacientes implementada sobre uma lista Python,
    respeitando uma capacidade maxima (assim como o array em C)."""

    def __init__(self):
        self.itens = []

    def vazia(self):
        return len(self.itens) == 0

    def cheia(self):
        return len(self.itens) == CAPACIDADE

    def tamanho(self):
        return len(self.itens)

    def enfileirar(self, paciente):
        """Insere um paciente no FIM da fila.
        Retorna True se OK, False se a fila estiver cheia."""
        if self.cheia():
            return False
        self.itens.append(paciente)
        return True

    def desenfileirar(self):
        """Remove o paciente da FRENTE da fila.
        Retorna (True, paciente) se OK, (False, None) se a fila
        estiver vazia."""
        if self.vazia():
            return False, None
        return True, self.itens.pop(0)

    def frente(self):
        """Consulta o paciente da frente SEM remove-lo.
        Retorna (True, paciente) se OK, (False, None) se vazia."""
        if self.vazia():
            return False, None
        return True, self.itens[0]


# ---------- TAD Fila de Prioridade (um balde por nivel) ----------


class FilaDePrioridade:
    """Cinco filas FIFO, uma para cada nivel de risco.

    Inserir e enfileirar no balde do nivel do paciente.
    Remover e varrer os baldes do mais grave ao menos grave e
    desenfileirar do primeiro que nao estiver vazio."""

    def __init__(self):
        # baldes[1] = azul ... baldes[5] = vermelho
        # A posicao 0 nao e usada, para que o indice coincida com
        # o numero do nivel de risco e o codigo fique mais legivel.
        self.baldes = [None] + [Fila() for _ in range(NIVEIS)]

    def total(self):
        soma = 0
        for nivel in range(1, NIVEIS + 1):
            soma = soma + self.baldes[nivel].tamanho()
        return soma

    def vazia(self):
        return self.total() == 0

    def inserir(self, paciente):
        """Enfileira o paciente no balde correspondente ao seu risco.
        Retorna True se OK, False se aquele balde estiver cheio."""
        return self.baldes[paciente.risco].enfileirar(paciente)

    def proximo(self):
        """Remove e retorna o paciente de maior prioridade.
        Entre pacientes de mesmo nivel, retorna o que chegou antes.
        Retorna (True, paciente) se OK, (False, None) se vazia."""
        for nivel in range(NIVEIS, 0, -1):
            if not self.baldes[nivel].vazia():
                return self.baldes[nivel].desenfileirar()
        return False, None

    def espiar(self):
        """Consulta quem sera o proximo SEM remove-lo."""
        for nivel in range(NIVEIS, 0, -1):
            if not self.baldes[nivel].vazia():
                return self.baldes[nivel].frente()
        return False, None


# ---------- Logica do problema ----------


class Paciente:
    """Dados de um paciente na fila de espera."""

    def __init__(self, senha, nome, risco):
        self.senha = senha
        self.nome = nome
        self.risco = risco


def classificar_risco(frequencia, saturacao, temperatura, dor):
    """Recebe os sinais vitais e retorna o nivel de risco de 1 a 5.

    Cada sinal vital e avaliado isoladamente e o nivel final e o
    MAIS GRAVE entre eles -- um unico sinal critico ja e suficiente
    para classificar o paciente como emergencia."""
    nivel = 1

    # Frequencia cardiaca (batimentos por minuto)
    if frequencia > 150 or frequencia < 40:
        nivel = max(nivel, 5)
    elif frequencia > 120:
        nivel = max(nivel, 4)
    elif frequencia > 100:
        nivel = max(nivel, 3)

    # Saturacao de oxigenio (porcentagem)
    if saturacao < 85:
        nivel = max(nivel, 5)
    elif saturacao < 90:
        nivel = max(nivel, 4)
    elif saturacao < 94:
        nivel = max(nivel, 3)

    # Temperatura corporal (graus Celsius)
    if temperatura >= 39.5 or temperatura <= 35.0:
        nivel = max(nivel, 5)
    elif temperatura >= 38.5:
        nivel = max(nivel, 3)
    elif temperatura >= 37.8:
        nivel = max(nivel, 2)

    # Dor referida pelo paciente (escala de 0 a 10)
    if dor >= 9:
        nivel = max(nivel, 4)
    elif dor >= 6:
        nivel = max(nivel, 3)
    elif dor >= 4:
        nivel = max(nivel, 2)

    return nivel


def ler_inteiro(mensagem, minimo, maximo):
    """Le um numero inteiro dentro da faixa informada.
    Insiste ate receber um valor valido."""
    while True:
        try:
            valor = int(input(mensagem))
        except ValueError:
            print("  Valor invalido. Digite um numero inteiro.")
            continue
        if valor < minimo or valor > maximo:
            print("  Valor fora da faixa (" + str(minimo) +
                  " a " + str(maximo) + ").")
            continue
        return valor


def ler_decimal(mensagem, minimo, maximo):
    """Le um numero decimal dentro da faixa informada."""
    while True:
        try:
            valor = float(input(mensagem).replace(",", "."))
        except ValueError:
            print("  Valor invalido. Digite um numero.")
            continue
        if valor < minimo or valor > maximo:
            print("  Valor fora da faixa (" + str(minimo) +
                  " a " + str(maximo) + ").")
            continue
        return valor


def admitir_paciente(fila, senha):
    """Coleta os dados, classifica o risco e insere o paciente na fila.
    Retorna a proxima senha a ser usada."""
    print("\n--- ADMISSAO DE PACIENTE ---")

    nome = input("Nome do paciente: ").strip()
    if nome == "":
        print("  Nome nao pode ser vazio. Admissao cancelada.")
        return senha

    print("Sinais vitais:")
    frequencia = ler_inteiro("  Frequencia cardiaca (20 a 250 bpm): ", 20, 250)
    saturacao = ler_inteiro("  Saturacao de oxigenio (50 a 100 %): ", 50, 100)
    temperatura = ler_decimal("  Temperatura (30.0 a 43.0 C): ", 30.0, 43.0)
    dor = ler_inteiro("  Dor referida (0 a 10): ", 0, 10)

    risco = classificar_risco(frequencia, saturacao, temperatura, dor)
    paciente = Paciente(senha, nome, risco)

    if not fila.inserir(paciente):
        print("  Fila lotada para este nivel. Admissao recusada.")
        return senha

    print("\n  Senha: " + str(senha))
    print("  Classificacao de risco: " + NOMES_RISCO[risco])
    print("  Tempo maximo de espera: " + str(TEMPO_MAXIMO[risco]) + " minutos")
    return senha + 1


def chamar_proximo(fila):
    """Remove e exibe o paciente de maior prioridade."""
    print("\n--- CHAMAR PROXIMO PACIENTE ---")

    ok, paciente = fila.proximo()
    if not ok:
        print("  Nao ha pacientes aguardando.")
        return

    print("  Senha " + str(paciente.senha) + " - " + paciente.nome)
    print("  Risco: " + NOMES_RISCO[paciente.risco])
    print("  Pacientes ainda na fila: " + str(fila.total()))


def listar_fila(fila):
    """Mostra todos os pacientes na ordem em que serao chamados."""
    print("\n--- ORDEM DE ATENDIMENTO ---")

    if fila.vazia():
        print("  Nao ha pacientes aguardando.")
        return

    print("  +-------+-------+----------------------+-----------+")
    print("  | ordem | senha | nome                 | risco     |")
    print("  +-------+-------+----------------------+-----------+")

    ordem = 0
    # Percorre do nivel mais grave para o menos grave; dentro de cada
    # balde, a ordem da lista ja e a ordem de chegada.
    for nivel in range(NIVEIS, 0, -1):
        for paciente in fila.baldes[nivel].itens:
            ordem = ordem + 1
            print("  | %5d | %5d | %-20.20s | %-9s |" %
                  (ordem, paciente.senha, paciente.nome,
                   NOMES_RISCO[paciente.risco]))

    print("  +-------+-------+----------------------+-----------+")
    print("  Total aguardando: " + str(fila.total()))


def mostrar_resumo(fila):
    """Exibe quantos pacientes ha em cada nivel de risco."""
    print("\n--- RESUMO POR NIVEL DE RISCO ---")

    for nivel in range(NIVEIS, 0, -1):
        print("  %-9s (alvo %3d min): %d" %
              (NOMES_RISCO[nivel], TEMPO_MAXIMO[nivel],
               fila.baldes[nivel].tamanho()))

    ok, paciente = fila.espiar()
    if ok:
        print("  Proximo a ser chamado: senha " + str(paciente.senha) +
              " (" + NOMES_RISCO[paciente.risco] + ")")
    else:
        print("  Nenhum paciente aguardando.")


def mostrar_menu():
    print("\n=======================================")
    print(" 1 - Admitir paciente")
    print(" 2 - Chamar proximo")
    print(" 3 - Listar ordem de atendimento")
    print(" 4 - Resumo por nivel de risco")
    print(" 0 - Sair")
    print("=======================================")


# ---------- Programa principal ----------


def main():
    print("=======================================")
    print("   SISTEMA DE FILA HOSPITALAR")
    print("=======================================")
    print("Autor: Gabriel Roberto Marinho Da Silva Reis")
    print("Data: 22/09/2026")
    print("O que foi feito: Programa em Python que usa o TAD Fila")
    print("para organizar o atendimento de um pronto-socorro,")
    print("classificando os pacientes por gravidade a partir")
    print("dos sinais vitais.")
    print("O que resolveu: garante que o paciente mais grave")
    print("seja chamado primeiro, sem que ninguem perca a vez")
    print("para quem chegou depois dentro do mesmo nivel de")
    print("risco.")
    print("=======================================")

    fila = FilaDePrioridade()
    senha = 1

    while True:
        mostrar_menu()

        try:
            opcao = input("Opcao: ").strip()
        except EOFError:
            break

        if opcao == "0" or opcao == "sair":
            break
        elif opcao == "1":
            senha = admitir_paciente(fila, senha)
        elif opcao == "2":
            chamar_proximo(fila)
        elif opcao == "3":
            listar_fila(fila)
        elif opcao == "4":
            mostrar_resumo(fila)
        else:
            print("  Opcao invalida.")

    print("\nEncerrando o programa.")


if __name__ == "__main__":
    main()
