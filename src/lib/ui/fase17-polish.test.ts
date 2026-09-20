/**
 * Fase 17 — polimento: copy PT, senha, paths, token mágico.
 */
import { describe, expect, it } from "vitest";
import { parseMagicTokenInput } from "@/lib/shopify.functions";
import { isAppPath } from "@/lib/training/session-nav";
import { resolveTabKey } from "@/lib/ui/app-nav";
import {
  ACCESS_PAYWALL_BENEFITS,
  ACCESS_PAYWALL_TITLE_STALE,
  EMPTY_RANKING_JOIN,
  MIN_PASSWORD_LENGTH,
  PERFORMANCE_LOCK_BENEFITS,
  PROOF_CARD_EYEBROW,
  SHARE_CARD_EYEBROW,
  SHARE_KIND_LABEL,
  SHARE_STREAK_LABEL,
} from "@/lib/ui/platform-copy";

describe("platform copy", () => {
  it("keeps share and proof labels in Portuguese", () => {
    expect(SHARE_KIND_LABEL.streak).toBe("Sequência");
    expect(SHARE_KIND_LABEL.prova).toBe("Prova");
    expect(SHARE_STREAK_LABEL).toBe("Sequência");
    expect(SHARE_CARD_EYEBROW).toBe("Card Soldiers");
    expect(PROOF_CARD_EYEBROW).toBe("Prova de desempenho");
  });

  it("requires password of 8 characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it("treats /hubs as an in-app path", () => {
    expect(isAppPath("/hubs")).toBe(true);
    expect(isAppPath("/desafios")).toBe(true);
    expect(isAppPath("/conteudo")).toBe(true);
  });

  it("keeps paywall and Performance lock copy in Portuguese", () => {
    expect(ACCESS_PAYWALL_TITLE_STALE).toContain("40 dias");
    expect(ACCESS_PAYWALL_BENEFITS).toHaveLength(3);
    expect(PERFORMANCE_LOCK_BENEFITS).toHaveLength(3);
    expect(EMPTY_RANKING_JOIN).toBe("Entrar no desafio");
  });
});

describe("shell tab mapping", () => {
  it("marks /desafios and /hubs as Social and /nutricao as Nutri", () => {
    expect(resolveTabKey("/desafios")).toBe("/social");
    expect(resolveTabKey("/hubs")).toBe("/social");
    expect(resolveTabKey("/nutricao")).toBe("/nutricao");
    expect(resolveTabKey("/suplementos")).toBe("/nutricao");
  });
});

describe("magic token", () => {
  it("rejects a short token", () => {
    expect(() => parseMagicTokenInput({ token: "x" })).toThrow("Token inválido");
    expect(() => parseMagicTokenInput({ token: "" })).toThrow("Token inválido");
    expect(parseMagicTokenInput({ token: "abcdefgh" })).toEqual({ token: "abcdefgh" });
  });
});
