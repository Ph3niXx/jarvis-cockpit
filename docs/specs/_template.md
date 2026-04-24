# <Nom de l'onglet>

> <Phrase-résumé de la finalité — 1 ligne>

## Scope
pro | perso | mixte

## Finalité fonctionnelle
<Pourquoi cet onglet existe, quel problème il résout>

## Parcours utilisateur
<Comment Jean utilise concrètement cet onglet>

## Fonctionnalités
<!--
RÈGLE : cette section décrit CE QUE L'UTILISATEUR VOIT ET FAIT, pas comment c'est implémenté.
BANNI : chemins de fichier (home.jsx:127), noms de composants (<SignalCard>), props/variables (gap=true, data.signals),
noms de colonnes DB (brief_html), formules (body.length / 280), endpoints (/rest/v1/…).
Les détails techniques vont dans "Front — structure UI" et "Back — sources de données".
Format bullet : **[Nom]** : [ce que l'utilisateur voit] + [ce qu'il peut faire] + [quel besoin ça couvre]. 1-2 phrases max.
-->
- **<Nom feature 1>** : <ce que l'utilisateur voit et peut faire, 1-2 phrases max, vocabulaire produit>
- **<Nom feature 2>** : <idem>

## Front — structure UI
<HTML principal, composants, interactions JS, IDs/classes clés>

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `renderXxx()` | ... | `index.html:L123` |

## Back — sources de données
<Tables Supabase concernées, colonnes clés, volumétrie>

## Back — pipelines qui alimentent
- Daily pipeline → <étapes/modules concernés>
- Weekly pipeline → <idem>
- Jarvis (local) → <idem>

## Appels externes
<API externes, endpoints, clés utilisées, fréquence>

## Dépendances
- Onglets : <liste>
- Pipelines : <liste>
- Variables d'env / secrets : <liste>

## États & edge cases
<Loading, empty state, erreur, mode dégradé>

## Limitations connues / TODO
- [ ] ...

## Dernière MAJ
<date ISO> — <commit SHA court>
