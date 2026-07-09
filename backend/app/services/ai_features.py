"""Recursos de IA sobre a transcricao (Secao 8): resumo, citacoes, mapa mental, chat."""
import httpx
from ..core.config import settings


def _ask(system: str, user: str, max_tokens: int = 2000) -> str:
    r = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": settings.ANTHROPIC_API_KEY,
                 "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": "claude-sonnet-4-6", "max_tokens": max_tokens,
              "system": system,
              "messages": [{"role": "user", "content": user}]},
        timeout=300,
    )
    r.raise_for_status()
    return r.json()["content"][0]["text"]


def summarize(text: str) -> str:
    return _ask("Voce resume transcricoes com fidelidade, sem inventar nada.",
                f"Resuma o conteudo abaixo em portugues, em ate 10 frases:\n\n{text[:60000]}")


def extract_quotes(text: str) -> str:
    return _ask("Voce extrai trechos de destaque de transcricoes.",
                f"Liste as 5 a 10 frases mais marcantes do texto abaixo, uma por linha, "
                f"citadas exatamente como aparecem:\n\n{text[:60000]}")


def mind_map(text: str) -> str:
    return _ask("Voce estrutura conteudo em mapas mentais.",
                "Gere um mapa mental do conteudo abaixo em formato de lista aninhada markdown "
                f"(tema central, ramos, sub-ramos):\n\n{text[:60000]}")


def generate_caption(text: str, style: str = "instagram", custom_style: str | None = None) -> str:
    styles = {
        "instagram": ("Voce cria legendas envolventes para Instagram.",
                      "Com base na transcricao abaixo, crie 3 opcoes de legenda para Instagram. "
                      "Cada uma deve ter: 1 frase de gancho impactante, 2-3 frases de conteudo, "
                      "chamada para acao e hashtags relevantes. Separe cada opcao com ---"),
        "tiktok":    ("Voce cria legendas para TikTok.",
                      "Com base na transcricao abaixo, crie 5 opcoes de legenda CURTA (max 150 caracteres cada) "
                      "para TikTok, com gancho nos primeiros segundos e hashtags relevantes. Uma por linha."),
        "linkedin":  ("Voce cria posts profissionais para LinkedIn.",
                      "Com base na transcricao abaixo, crie uma legenda para LinkedIn: "
                      "comece com insight poderoso, desenvolva em 3-4 paragrafos curtos, "
                      "termine com pergunta para engajamento. Tom profissional e direto."),
        "curta":     ("Voce cria legendas curtissimas para redes sociais.",
                      "Com base na transcricao abaixo, crie 5 opcoes de legenda CURTA (max 150 caracteres cada) "
                      "para usar em Reels ou Stories. Uma por linha."),
        "outro":     ("Voce cria legendas para redes sociais seguindo instrucoes especificas do usuario.",
                      "Com base na transcricao abaixo, crie 3 opcoes de legenda seguindo esta instrucao do "
                      f"usuario: \"{(custom_style or 'estilo livre, adequado ao conteudo').strip()}\"."),
    }
    system, prompt = styles.get(style, styles["instagram"])
    return _ask(system, f"{prompt}\n\n<transcricao>{text[:60000]}</transcricao>", max_tokens=1500)


def write_script(text: str) -> str:
    return _ask(
        "Voce escreve roteiros de video a partir de transcricoes, com fidelidade ao conteudo original.",
        "Com base no conteudo abaixo, escreva um roteiro estruturado para um novo video: "
        "gancho de abertura, desenvolvimento em topicos com marcacoes de fala, e fechamento com chamada "
        f"para acao. Use portugues claro e direto:\n\n{text[:60000]}",
        max_tokens=2500,
    )


def chat(text: str, question: str, history: list) -> str:
    msgs = history + [{"role": "user", "content": question}]
    r = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": settings.ANTHROPIC_API_KEY,
                 "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": "claude-sonnet-4-6", "max_tokens": 2000,
              "system": ("Responda perguntas usando APENAS a transcricao abaixo. Se a resposta nao "
                         f"estiver nela, diga que o conteudo nao cobre isso.\n\n<transcricao>{text[:80000]}</transcricao>"),
              "messages": msgs},
        timeout=300,
    )
    r.raise_for_status()
    return r.json()["content"][0]["text"]
