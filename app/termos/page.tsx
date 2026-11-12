import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Licenciamento e Termos de Uso | RevezaPix",
  description: "Termos da licença de uso do sistema RevezaPix.",
  robots: { index: false, follow: false },
};

const sectionClass = "space-y-2";
const headingClass = "text-base font-semibold text-white";
const paragraphClass = "text-sm leading-6 text-white/65";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <a href="/adm" className="text-sm text-lime/80 transition hover:text-lime">
        ← Voltar ao painel
      </a>

      <header className="mt-6 rounded-3xl border border-lime/15 bg-[radial-gradient(ellipse_at_top_right,rgba(197,243,107,.12),transparent_60%),#141b16] p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-[.25em] text-lime">SISTEMA DE GESTÃO DE COBRANÇAS PIX</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">Reveza<span className="text-lime">Pix</span></h1>
        <h2 className="mt-3 text-base font-semibold text-white/75 sm:text-lg">Licenciamento e Termos de Uso</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">
          Os dados do LICENCIANTE já estão preenchidos. Identifique o LICENCIADO e complete as condições comerciais na
          proposta ou no termo assinado pelas partes.
        </p>
      </header>

      <article className="mt-8 space-y-7">
        <section className={sectionClass}>
          <h2 className={headingClass}>1. Partes e identificação da licença</h2>
          <p className={paragraphClass}>
            Este instrumento é celebrado entre <strong className="text-white/85">PAULO SERGIO DE BRITO BANDEIRA LTDA</strong>,
            nome fantasia <strong className="text-white/85">Tex-TrampoExpress</strong>, inscrita no CNPJ sob o nº{" "}
            <strong className="text-white/85">61.618.912/0001-16</strong>, com endereço em{" "}
            <strong className="text-white/85">Brasília, Distrito Federal</strong>, doravante “LICENCIANTE”; e o
            estabelecimento licenciado identificado na proposta, ordem de serviço ou assinatura deste instrumento,
            doravante “LICENCIADO”.
          </p>
          <p className={paragraphClass}>
            A contratação deve identificar o estabelecimento, a data, o valor pago, a quantidade de caixas/terminais incluídos
            e eventuais serviços de instalação. Esses dados podem constar em proposta ou recibo vinculado a estes termos.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>2. Objeto e natureza da licença</h2>
          <p className={paragraphClass}>
            O LICENCIANTE concede ao LICENCIADO uma licença de uso do sistema{" "}
            <strong className="text-white">RevezaPix</strong>, configurado para o
            estabelecimento e para a quantidade de caixas/terminais definida na contratação. A licença permite o uso interno
            do sistema na operação comercial do LICENCIADO. A seção seguinte descreve as funções e o fluxo operacional do
            produto; os recursos efetivamente contratados são delimitados pela proposta ou ordem de serviço.
          </p>
          <p className={paragraphClass}>
            Esta contratação licencia o uso de uma cópia configurada; <strong className="text-white/85">não é venda nem cessão
            da propriedade intelectual</strong>. O código-fonte, arquitetura, documentação, know-how e demais direitos sobre
            o software permanecem com seus respectivos titulares. A licença é não exclusiva: o LICENCIANTE pode desenvolver,
            licenciar, instalar e comercializar outras cópias para outros clientes, sem exclusividade territorial ou comercial.
          </p>
          <p className={paragraphClass}>
            A licença não autoriza o LICENCIADO a revender, sublicenciar, publicar, copiar para terceiros ou explorar
            comercialmente o software, nem a remover avisos de autoria, salvo autorização expressa e escrita do LICENCIANTE.
            Marcas e logotipos de terceiros permanecem pertencendo aos seus respectivos titulares.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>3. RevezaPix: finalidade, recursos e operação</h2>
          <p className={paragraphClass}>
            O <strong className="text-white">RevezaPix</strong> é um sistema web instalável como PWA, destinado a organizar
            a emissão de cobranças Pix no ponto de venda. Ele reúne um painel administrativo para o responsável pela
            operação e uma interface simplificada para o operador do caixa. O sistema prepara a cobrança e apresenta o
            código para pagamento; não é banco, carteira digital, instituição de pagamento nem serviço de liquidação.
          </p>

          <h3 className="pt-2 text-sm font-semibold text-white/85">Configuração e capacidade</h3>
          <p className={paragraphClass}>
            O responsável pode cadastrar até <strong className="text-white/85">10 chaves Pix</strong> e configurar quais
            delas ficam disponíveis em cada caixa. O número de caixas/terminais incluídos depende do limite registrado na
            contratação e da configuração implantada; não se presume quantidade ilimitada. Cada caixa possui seu próprio
            link de acesso, que o responsável pode compartilhar com o operador designado e revogar ou renovar quando
            necessário. O acesso do operador fica restrito ao caixa autorizado.
          </p>

          <h3 className="pt-2 text-sm font-semibold text-white/85">Emissão da cobrança</h3>
          <p className={paragraphClass}>
            No caixa, o operador seleciona uma chave Pix habilitada, informa o valor da venda e solicita a geração. O
            RevezaPix monta no próprio navegador o conteúdo Pix com o valor indicado, identificador da cobrança e
            verificador de integridade CRC16; em seguida, gera e exibe o QR Code para leitura pelo aplicativo bancário do
            pagador. O valor é definido manualmente para cada cobrança. A operação não depende de redigitar os dados do
            recebedor a cada venda, mas a chave selecionada e o valor devem ser conferidos pelo operador antes de apresentar
            o QR Code ao cliente.
            Trata-se de um QR Code Pix gerado pelo sistema com valor preenchido; não é uma cobrança dinâmica criada ou
            monitorada diretamente pela instituição financeira.
          </p>

          <h3 className="pt-2 text-sm font-semibold text-white/85">Apresentação ao cliente e confirmação</h3>
          <p className={paragraphClass}>
            Quando contratado e configurado, o modo de tela do cliente apresenta o QR Code e o valor da cobrança em uma
            tela separada, vinculada ao caixa. A tela consulta periodicamente o Supabase para refletir a cobrança ativa
            (com atualização aproximada a cada 2,5 segundos, sujeita à conexão e à disponibilidade do serviço). Depois
            que o cliente paga, o operador deve verificar o crédito diretamente no aplicativo ou extrato bancário e então
            confirmar o recebimento no RevezaPix. Essa confirmação é um registro operacional feito pelo usuário: o sistema
            não consulta a conta bancária e não detecta nem confirma o pagamento automaticamente.
          </p>

          <h3 className="pt-2 text-sm font-semibold text-white/85">Histórico, organização e benefícios operacionais</h3>
          <p className={paragraphClass}>
            As cobranças registradas podem compor um histórico consultável por caixa, chave e período, com valor, horário
            e situação informada pelo operador. O responsável pode acompanhar os caixas e seus registros pelo painel e
            configurar o prazo de retenção disponível no sistema, de 1 a 3.650 dias (60 dias por padrão na configuração
            inicial). A separação por caixa ajuda a identificar onde cada cobrança foi gerada e a organizar a conferência
            das vendas.
          </p>
          <p className={paragraphClass}>
            Ao deixar chaves e dados do recebedor previamente configurados e gerar o QR Code a partir do valor digitado,
            o fluxo pode reduzir etapas repetitivas, redigitação e o tempo gasto para preparar cada cobrança, além de
            facilitar a alternância entre operadores e caixas. O painel e o histórico também podem reduzir esforço de
            conferência e busca de registros. Esses são benefícios operacionais esperados, não uma promessa de economia
            financeira, aumento de vendas, eliminação de erros ou prazo fixo de atendimento; os resultados dependem do
            volume de vendas, configuração, dispositivos, conexão e procedimentos do LICENCIADO.
          </p>
          <p className={paragraphClass}>
            A rapidez de geração refere-se à preparação e exibição do QR Code pelo sistema. A leitura, autorização,
            processamento, liquidação e eventual confirmação do Pix dependem do cliente, do aplicativo bancário, da
            instituição financeira, da conexão e de serviços de terceiros. O RevezaPix não altera tarifas bancárias nem
            garante que uma transferência será concluída.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>4. Prazo vitalício e pagamento</h2>
          <p className={paragraphClass}>
            Após o pagamento integral do preço de licença indicado na contratação, o direito de uso é concedido por prazo
            vitalício, sem mensalidade ou renovação periódica, para o LICENCIADO identificado e dentro do escopo contratado.
            A licença não pode ser transferida para outro estabelecimento ou titular sem autorização escrita do LICENCIANTE.
          </p>
          <p className={paragraphClass}>
            “Vitalícia” refere-se ao prazo da licença de uso e não significa hospedagem em nuvem, disponibilidade permanente
            de serviços de terceiros, suporte gratuito, atualizações ilimitadas ou desenvolvimento contínuo. A licença pode
            ser suspensa ou encerrada em caso de inadimplemento da contratação ou uso ilícito, observados a notificação,
            eventual prazo para correção e os direitos previstos na legislação aplicável.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>5. Instalação, alterações e serviços</h2>
          <p className={paragraphClass}>
            A instalação e configuração incluídas são apenas as descritas na proposta ou ordem de serviço. Novos caixas,
            dispositivos, integrações, migrações, personalizações, alterações de infraestrutura e reinstalações podem exigir
            orçamento separado. O LICENCIANTE não é obrigado a fornecer novas funcionalidades ou adaptações sem contratação.
          </p>
          <p className={paragraphClass}>
            O LICENCIADO deve manter dispositivos, navegador, conexão, credenciais e serviços de terceiros em condições
            adequadas. Deve proteger os links secretos e senhas, limitar o acesso aos operadores autorizados e avisar o
            LICENCIANTE quando suspeitar de acesso indevido.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>6. Suporte técnico por hora</h2>
          <p className={paragraphClass}>
            O suporte e a manutenção não estão incluídos como serviço mensal na licença. Podem ser solicitados pelo canal
            informado pelo LICENCIANTE e serão cobrados por hora, conforme valor, forma de contagem, escopo e eventual
            deslocamento previamente informados em orçamento. Nenhum serviço pago será iniciado sem aprovação do LICENCIADO.
          </p>
          <p className={paragraphClass}>
            A licença vitalícia não cria obrigação de atendimento gratuito. Correções, atualizações ou obrigações decorrentes
            de garantias legais aplicáveis não são afastadas por esta cláusula.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>7. Funcionamento do Pix e conferência de pagamentos</h2>
          <p className={paragraphClass}>
            O sistema monta localmente o payload Pix e exibe o QR Code, podendo registrar a sessão e seu histórico conforme
            a configuração contratada. <strong className="text-white/85">O sistema não movimenta valores, não substitui banco
            ou instituição de pagamento e não confirma, por conta própria, o crédito na conta do LICENCIADO.</strong>
          </p>
          <p className={paragraphClass}>
            Antes de entregar produtos ou serviços, o operador do LICENCIADO deve conferir o recebimento diretamente no
            aplicativo ou extrato oficial da instituição financeira. Comprovantes apresentados pelo pagador, isoladamente,
            não substituem a confirmação do crédito. O LICENCIADO é responsável por cadastrar e revisar suas chaves Pix,
            valores, dados do recebedor e permissões de acesso.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>8. Dados e privacidade</h2>
          <p className={paragraphClass}>
            O LICENCIADO é responsável pela legalidade, exatidão e atualização dos dados que inserir, inclusive chaves Pix,
            nomes de operadores e registros comerciais, e por definir quem pode acessá-los. Quando houver armazenamento ou
            sincronização em serviços de terceiros, seu funcionamento, disponibilidade e termos próprios também se aplicam.
          </p>
          <p className={paragraphClass}>
            O LICENCIANTE poderá acessar dados estritamente necessários para instalar, prestar suporte ou diagnosticar falhas,
            mediante autorização do LICENCIADO quando aplicável. As partes devem tratar dados pessoais conforme a legislação
            de proteção de dados, adotar medidas de segurança razoáveis e comunicar incidentes relevantes. Não envie senhas,
            códigos de acesso ou dados bancários completos pelo WhatsApp.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>9. Limites e responsabilidades</h2>
          <p className={paragraphClass}>
            O LICENCIADO deve manter os registros que precisar, conferir os pagamentos na instituição financeira e manter
            cópias de segurança quando disponíveis. O LICENCIANTE não responde por falhas de internet, indisponibilidade de
            bancos, Supabase, hospedagem ou outros terceiros, uso incorreto, credenciais compartilhadas, dados inseridos
            incorretamente ou decisões tomadas sem conferência do crédito, sem prejuízo das responsabilidades que a lei não
            permita excluir ou limitar.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>10. Aceite e condições específicas</h2>
          <p className={paragraphClass}>
            A proposta, comprovante ou ordem de serviço deve registrar o preço da licença, a quantidade de caixas/terminais,
            o escopo da instalação e as condições específicas acordadas. Em caso de conflito, prevalecem as condições
            específicas assinadas pelas partes, sem afastar direitos obrigatórios previstos em lei.
          </p>
          <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4 text-sm leading-6 text-white/55">
            <p>Estabelecimento/licenciado: __________________________________________</p>
            <p>CNPJ/CPF: __________________________ Data: ____ / ____ / ________</p>
            <p>Caixas/terminais incluídos: __________ Valor e forma de pagamento: __________________</p>
            <p className="mt-4">Assinatura do LICENCIADO: _________________________________________</p>
            <p>Assinatura do LICENCIANTE: _________________________________________</p>
          </div>
        </section>
      </article>
    </main>
  );
}
