"""Jarvis — Test de connexion au LLM local via LM Studio."""

import sys
import time

from openai import OpenAI, APIConnectionError, APITimeoutError

from config import (
    LM_STUDIO_BASE_URL,
    LM_STUDIO_API_KEY,
    LLM_MODEL,
    LLM_TEMPERATURE,
    LLM_MAX_TOKENS,
)

SYSTEM_PROMPT = (
    "Tu es Jarvis, l'assistant personnel de Tony. "
    "Tu es concis, intelligent, et tu parles français. /no_think"
)

TEST_MESSAGE = "Bonjour Jarvis. Présente-toi en 2 phrases et dis-moi ce que tu peux faire pour moi."


def main():
    client = OpenAI(base_url=LM_STUDIO_BASE_URL, api_key=LM_STUDIO_API_KEY)

    # 1. Check server connectivity
    print("=" * 60)
    print("JARVIS — Test de connexion LM Studio")
    print("=" * 60)
    print(f"\nServeur : {LM_STUDIO_BASE_URL}")

    try:
        models = client.models.list()
    except (APIConnectionError, ConnectionError):
        print("\n[ERREUR] Impossible de joindre LM Studio.")
        print("  -> Vérifie que LM Studio est lancé avec le serveur activé.")
        print(f"  -> URL attendue : {LM_STUDIO_BASE_URL}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERREUR] Erreur inattendue lors de la connexion : {e}")
        sys.exit(1)

    # 2. List loaded models
    model_ids = [m.id for m in models.data]
    print(f"Modèles chargés ({len(model_ids)}) :")
    for mid in model_ids:
        print(f"  - {mid}")

    if not model_ids:
        print("\n[ERREUR] Aucun modèle chargé dans LM Studio.")
        print("  -> Charge un modèle dans LM Studio avant de relancer le test.")
        sys.exit(1)

    # 3. Send test prompt
    print(f"\nModèle utilisé : {LLM_MODEL}")
    print(f"Prompt : {TEST_MESSAGE}")
    print("-" * 60)

    try:
        t0 = time.perf_counter()
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": TEST_MESSAGE},
            ],
            temperature=LLM_TEMPERATURE,
            max_tokens=LLM_MAX_TOKENS,
        )
        elapsed = time.perf_counter() - t0
    except APITimeoutError:
        print("\n[ERREUR] Timeout — le modèle met trop de temps à répondre.")
        print("  -> Vérifie que le modèle est bien chargé (pas en cours de téléchargement).")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERREUR] Échec de la génération : {e}")
        sys.exit(1)

    # 4. Display results
    reply = response.choices[0].message.content
    usage = response.usage

    print(f"\nRéponse de Jarvis :\n{reply}")
    print("-" * 60)

    if usage:
        prompt_tokens = usage.prompt_tokens
        completion_tokens = usage.completion_tokens
        total_tokens = usage.total_tokens
        print(f"Tokens : {prompt_tokens} prompt + {completion_tokens} completion = {total_tokens} total")
        if elapsed > 0 and completion_tokens:
            speed = completion_tokens / elapsed
            print(f"Vitesse : {speed:.1f} tokens/s ({elapsed:.1f}s)")
    else:
        print(f"Temps de réponse : {elapsed:.1f}s")

    print("\nJarvis est opérationnel.")


if __name__ == "__main__":
    main()
