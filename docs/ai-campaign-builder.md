# AI Campaign Builder

AI Campaign Builder ayuda al merchant a preparar un borrador de campana con
copy, diseno, traducciones y variantes A/B. No publica ni guarda cambios hasta
que el merchant revisa la sugerencia y pulsa `Apply suggestion`, y despues
guarda la campana.

## Arquitectura

- UI admin: `app/components/AiCampaignBuilder.tsx`.
- Servicio server: `app/services/ai/campaignGenerator.server.ts`.
- Prompt versionado: `app/services/ai/campaignPrompts.server.ts`.
- Tipos compartidos: `app/types/ai-campaign.ts`.
- Gating: `AI_CAMPAIGN_BUILDER`, plan minimo `GROWTH`; Pro usa el limite alto.

## Provider

Por defecto se usa el provider mock deterministico. Esto mantiene dev y E2E sin
dependencias externas.

Para probar un provider real:

```bash
PROMO_PULSE_AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
```

Si el provider externo falla, el servicio registra el error y vuelve al mock.

## Guardrails

El servicio sanea la salida antes de devolverla:

- reemplaza claims de stock o escasez no verificables;
- bloquea descuentos, free gifts o free shipping si el merchant no proveyo una
  oferta real o la campana no lo soporta;
- fuerza `status: DRAFT`;
- limita largos de copy y campos de diseno;
- crea experimentos sugeridos en `DRAFT`.

Los claims bloqueados quedan en `safety.blockedClaims` para auditoria, pero no
se muestran como copy aplicable.

## Flujo Admin

1. El merchant completa objetivo, producto/categoria, evento, pais/idioma, tono
   y oferta real si existe.
2. `Generate with AI` devuelve una preview.
3. `Apply suggestion` rellena el formulario base y guarda un payload oculto.
4. `Save campaign` crea la campana, aplica diseno/traducciones y crea variantes
   A/B en borrador.

## Testing

- Unit: `npm run test:unit -- app/services/ai/campaignGenerator.server.test.ts`
- E2E: `npm run test:e2e -- tests/e2e/ai-campaign-builder.spec.ts`

## Limitaciones

- No se habilita auto-publicacion.
- La integracion OpenAI es opt-in; el mock sigue siendo el camino soportado para
  CI/E2E.
- Las traducciones mock son plantillas controladas, no traduccion humana.
- El experimento creado no se inicia automaticamente.
