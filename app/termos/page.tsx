import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Licenciamento e Termos de Uso | RevezaPix",
  description: "Termos da licença de uso do sistema RevezaPix.",
  robots: { index: false, follow: false },
};

const sectionClass = "space-y-2";
const headingClass = "text-base font-semibold text-white";
const paragraphClass = "text-sm leading-6 text-white/65";
const termsVersion = "2026-11-11-v1";

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
            link de acesso, que funciona como credencial: qualquer pessoa que o possua poderá tentar acessar o caixa
            correspondente, sujeito à validação do sistema. O LICENCIADO deve compartilhar o link apenas com operadores
            autorizados e solicitar sua renovação imediatamente em caso de desligamento, perda ou suspeita de divulgação.
            A renovação invalida o link anterior. Um mesmo dispositivo pode operar mais de um caixa quando cada acesso
            estiver configurado e autorizado.
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
            “Vitalícia” refere-se ao prazo do direito de uso da versão licenciada, não a uma garantia de funcionamento
            perpétuo de hospedagem, domínio, banco de dados, internet, lojas de aplicativos ou outros serviços de terceiros.
            Salvo se a proposta assinada disser expressamente o contrário, cabe ao LICENCIADO contratar, pagar e manter a
            infraestrutura necessária à sua operação, incluindo hospedagem/servidor, banco de dados, domínio e serviços de
            terceiros, bem como observar seus limites, políticas e condições comerciais. A licença, por si só, não inclui
            esses custos recorrentes, suporte ilimitado nem desenvolvimento contínuo.
          </p>
          <p className={paragraphClass}>
            Se a infraestrutura necessária for descontinuada, ficar indisponível ou deixar de ser compatível, as partes
            poderão acordar a migração ou substituição mediante orçamento. A suspensão ou encerramento da licença por
            inadimplemento ou uso ilícito observará comunicação, oportunidade razoável de regularização quando cabível e
            os direitos que a legislação aplicável não permita afastar.
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
            O LICENCIADO deve manter dispositivos e navegadores compatíveis, conexão, credenciais e serviços de terceiros
            em condições adequadas; manter cópias dos dados e registros de que necessite; e restringir o acesso aos
            operadores autorizados. O funcionamento instalável como PWA depende de navegador e dispositivo compatíveis.
            O LICENCIADO deve avisar o LICENCIANTE quando suspeitar de acesso indevido.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>6. Suporte técnico, manutenção e atualizações</h2>
          <p className={paragraphClass}>
            Estão incluídos <strong className="text-white/85">30 (trinta) dias corridos de suporte técnico remoto</strong>,
            contados da conclusão da instalação/configuração inicial descrita na contratação. Esse período cobre orientação
            para configuração inicial e análise/correção de falhas reproduzíveis no funcionamento das funções contratadas.
            Não inclui novos recursos, personalizações, treinamento recorrente, suporte a equipamentos ou serviços de
            terceiros, nem custos de hospedagem, banco de dados ou infraestrutura do LICENCIADO.
          </p>
          <p className={paragraphClass}>
            Após o período inicial, suporte, treinamento, reconfiguração, consultoria e manutenção solicitados serão
            cobrados à parte, por hora técnica ou conforme orçamento previamente aprovado, com indicação de escopo, valor,
            forma de contagem e eventual deslocamento. Nenhum serviço adicional pago será iniciado sem aprovação do
            LICENCIADO. Correções críticas de segurança ou estabilidade atribuíveis ao RevezaPix serão disponibilizadas
            sem custo de licença; a implantação poderá depender de acesso à infraestrutura mantida pelo LICENCIADO.
            Novos módulos e funcionalidades poderão ser oferecidos separadamente, sem afastar garantias e direitos legais.
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
            identificação dos responsáveis/operadores e registros comerciais, por definir quem pode acessá-los e por
            manter cópias dos dados que precisar preservar. Quando houver armazenamento ou sincronização em serviços de
            terceiros, seu funcionamento, disponibilidade, políticas e termos próprios também se aplicam.
          </p>
          <p className={paragraphClass}>
            O LICENCIANTE acessará dados somente na medida necessária à instalação, ao suporte ou ao diagnóstico, com
            autorização do LICENCIADO quando aplicável e observando a legislação de proteção de dados. Cada parte deverá
            adotar medidas de segurança razoáveis para os dados sob seu controle e comunicar incidentes relevantes conforme
            suas obrigações legais. O registro eletrônico do aceite destes termos guarda a conta autenticada, a versão do
            documento e a data/hora; não guarda o endereço IP para essa finalidade. Não envie senhas, links secretos,
            códigos de acesso ou dados bancários completos por canais de suporte.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>9. Obrigações fiscais, licitude e uso permitido</h2>
          <p className={paragraphClass}>
            O LICENCIADO declara ser titular das chaves Pix cadastradas ou possuir autorização válida para utilizá-las.
            Compete ao LICENCIADO cumprir as obrigações fiscais, contábeis, tributárias e regulatórias relacionadas à sua
            atividade e às vendas, inclusive emitir os documentos fiscais exigidos e declarar corretamente suas receitas.
            O RevezaPix não substitui sistema fiscal, contábil, ERP ou emissor de nota fiscal.
          </p>
          <p className={paragraphClass}>
            É proibido utilizar o sistema para fraude, lavagem de dinheiro, ocultação de receitas, sonegação, violação de
            direitos de terceiros ou qualquer finalidade ilícita, bem como tentar obter acesso não autorizado, interferir
            na segurança, realizar engenharia reversa ou utilizar o sistema para sobrecarregar ou prejudicar a plataforma.
            O LICENCIANTE não valida a titularidade das chaves nem audita vendas ou declarações fiscais; essa limitação não
            afasta responsabilidades que possam ser atribuídas a qualquer parte por lei.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>10. Disponibilidade e limites de responsabilidade</h2>
          <p className={paragraphClass}>
            O LICENCIADO deve manter os registros necessários à sua operação e confirmar pagamentos diretamente na
            instituição financeira. A disponibilidade pode ser afetada por internet, dispositivos, navegadores, serviços
            bancários, Supabase, hospedagem, domínio, provedores de nuvem ou outros terceiros. A tela do cliente depende
            de conexão e sincronização com o serviço configurado; atrasos ou interrupções podem ocorrer.
          </p>
          <p className={paragraphClass}>
            Cada parte responde pelos atos e omissões que lhe sejam atribuíveis, nos limites da legislação aplicável.
            Nenhuma disposição destes termos exclui responsabilidade ou direito que não possa ser legalmente afastado.
            O LICENCIANTE não garante resultado comercial, economia determinada, disponibilidade ininterrupta, conclusão
            de transferências Pix nem eliminação de erros operacionais.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>11. Aceite e condições específicas</h2>
          <p className={paragraphClass}>
            A proposta, comprovante ou ordem de serviço deve registrar o preço da licença, a quantidade de caixas/terminais,
            o escopo da instalação e as condições específicas acordadas. Em caso de conflito, prevalecem as condições
            específicas assinadas pelas partes, sem afastar direitos obrigatórios previstos em lei.
          </p>
          <p className={paragraphClass}>
            O aceite eletrônico é realizado pelo administrador autenticado do LICENCIADO mediante confirmação expressa.
            O sistema registra a conta vinculada ao aceite, a versão destes termos e a data/hora do registro, sem registrar
            o endereço IP para essa finalidade. O administrador declara ter poderes para aceitar em nome do LICENCIADO e
            compromete-se a dar ciência destes termos aos operadores que utilizarem o sistema.
          </p>
          <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4 text-sm leading-6 text-white/55">
            <p>Estabelecimento/licenciado: __________________________________________</p>
            <p>CNPJ/CPF: __________________________ Data: ____ / ____ / ________</p>
            <p>Caixas/terminais incluídos: __________ Valor e forma de pagamento: __________________</p>
            <p className="mt-4">Assinatura do LICENCIADO: _________________________________________</p>
            <p>Assinatura do LICENCIANTE: _________________________________________</p>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>12. Suspensão, encerramento e disposições gerais</h2>
          <p className={paragraphClass}>
            Em caso de violação material destes termos, tentativa de fraude, acesso não autorizado ou risco à segurança,
            o LICENCIANTE poderá limitar ou suspender o acesso na medida necessária para conter o risco. Quando razoável
            e permitido, comunicará o motivo e dará oportunidade para correção antes do encerramento definitivo. Serão
            observados o contrato, a legislação aplicável e eventuais direitos de reembolso ou reparação legalmente devidos;
            não há renúncia antecipada a esses direitos.
          </p>
          <p className={paragraphClass}>
            Estes termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de Brasília, Distrito Federal,
            quando legalmente permitido, preservados os foros obrigatórios e os direitos de competência previstos na
            legislação, inclusive nas relações de consumo.
          </p>
        </section>
        <p className="border-t border-white/[.08] pt-4 text-xs text-white/35">
          Versão {termsVersion} · Licenciante: PAULO SERGIO DE BRITO BANDEIRA LTDA, nome fantasia Tex-TrampoExpress.
        </p>
      </article>
    </main>
  );
}
