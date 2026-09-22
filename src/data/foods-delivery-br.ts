/**
 * Curated BR delivery / restaurant generics — no brand networks, no invented EANs.
 * source: internal. Tags via synonyms for picker Delivery chip.
 */
/* eslint-disable prettier/prettier -- compact FoodDef rows match lote 2 */
import { INTERNAL_SOURCE_VERSION, type FoodDef } from "@/data/foods-helpers";

const TAGS = ["delivery", "restaurante", "ifood", "self-service"] as const;

function f(
  d: Omit<FoodDef, "sourceVersion" | "synonyms"> & { synonyms?: string[] },
): FoodDef {
  const extra = d.synonyms ?? [];
  return {
    ...d,
    synonyms: [...extra, ...TAGS],
    sourceVersion: INTERNAL_SOURCE_VERSION,
  };
}

const s100 = [{ id: "s-100g", label: "100 g", grams: 100, isDefault: true }];

export const FOOD_DEFS_DELIVERY_BR: FoodDef[] = [
  // Self-service / quilo / PF
  f({ id: "pf-frango-grelhado", name: "PF frango grelhado (prato feito)", category: "aves", synonyms: ["pf", "prato feito", "executivo"], kcal: 145, proteinG: 14.0, carbG: 14.0, fatG: 4.0, servings: [{ id: "s-prato", label: "1 prato", grams: 450, isDefault: true }] }),
  f({ id: "pf-bife-acebolado", name: "PF bife acebolado", category: "carnes", synonyms: ["pf bife", "bife acebolado"], kcal: 160, proteinG: 13.0, carbG: 12.0, fatG: 7.0, servings: [{ id: "s-prato", label: "1 prato", grams: 450, isDefault: true }] }),
  f({ id: "pf-file-peixe", name: "PF filé de peixe", category: "peixes", synonyms: ["pf peixe", "filé peixe"], kcal: 130, proteinG: 13.0, carbG: 13.0, fatG: 3.5, servings: [{ id: "s-prato", label: "1 prato", grams: 450, isDefault: true }] }),
  f({ id: "pf-strogonoff-frango", name: "PF strogonoff de frango", category: "aves", synonyms: ["strogonoff", "estrogonofe"], kcal: 155, proteinG: 11.0, carbG: 14.0, fatG: 6.5, servings: [{ id: "s-prato", label: "1 prato", grams: 450, isDefault: true }] }),
  f({ id: "self-service-quilo", name: "Self-service por quilo (média)", category: "outros", synonyms: ["quilo", "por quilo", "buffet"], kcal: 140, proteinG: 9.0, carbG: 14.0, fatG: 5.5, servings: [{ id: "s-300g", label: "300 g", grams: 300, isDefault: true }, { id: "s-100g", label: "100 g", grams: 100 }] }),
  f({ id: "self-service-salada", name: "Self-service salada (folha)", category: "hortalicas", synonyms: ["salada self", "buffet salada"], kcal: 35, proteinG: 2.0, carbG: 4.0, fatG: 1.5, fiberG: 2.0, servings: [{ id: "s-prato", label: "1 prato", grams: 150, isDefault: true }] }),
  f({ id: "self-service-carne", name: "Self-service carne assada", category: "carnes", synonyms: ["carne buffet"], kcal: 220, proteinG: 26.0, carbG: 0, fatG: 13.0, servings: s100 }),
  f({ id: "self-service-feijoada", name: "Self-service feijoada", category: "carnes", synonyms: ["feijoada"], kcal: 155, proteinG: 9.0, carbG: 12.0, fatG: 8.0, servings: [{ id: "s-prato", label: "1 prato", grams: 350, isDefault: true }] }),
  f({ id: "executivo-parmegiana", name: "Executivo filé à parmegiana", category: "carnes", synonyms: ["parmegiana", "filé parmegiana"], kcal: 175, proteinG: 14.0, carbG: 12.0, fatG: 8.5, servings: [{ id: "s-prato", label: "1 prato", grams: 480, isDefault: true }] }),
  f({ id: "executivo-iscas-frango", name: "Executivo iscas de frango", category: "aves", synonyms: ["iscas de frango"], kcal: 165, proteinG: 15.0, carbG: 13.0, fatG: 6.0, servings: [{ id: "s-prato", label: "1 prato", grams: 450, isDefault: true }] }),

  // Bakeries / padaria salgados
  f({ id: "pao-queijo-padaria", name: "Pão de queijo (padaria)", category: "cereais", synonyms: ["pão de queijo", "padaria"], kcal: 310, proteinG: 7.5, carbG: 33.0, fatG: 16.5, servings: [{ id: "s-unidade", label: "1 unidade", grams: 45, isDefault: true }] }),
  f({ id: "croissant-presunto-queijo", name: "Croissant presunto e queijo", category: "cereais", synonyms: ["croissant salgado", "padaria"], kcal: 320, proteinG: 11.0, carbG: 28.0, fatG: 18.0, sodiumMg: 650, servings: [{ id: "s-unidade", label: "1 unidade", grams: 90, isDefault: true }] }),
  f({ id: "folhado-frango", name: "Folhado de frango", category: "industrializados", synonyms: ["folhado", "padaria"], kcal: 285, proteinG: 9.0, carbG: 26.0, fatG: 16.0, servings: [{ id: "s-unidade", label: "1 unidade", grams: 80, isDefault: true }] }),
  f({ id: "enroladinho-salsicha", name: "Enroladinho de salsicha", category: "industrializados", synonyms: ["enroladinho", "padaria"], kcal: 295, proteinG: 8.0, carbG: 27.0, fatG: 17.0, sodiumMg: 700, servings: [{ id: "s-unidade", label: "1 unidade", grams: 70, isDefault: true }] }),
  f({ id: "esfiha-carne", name: "Esfiha de carne", category: "industrializados", synonyms: ["esfiha", "esfirra"], kcal: 245, proteinG: 10.0, carbG: 28.0, fatG: 10.0, servings: [{ id: "s-unidade", label: "1 unidade", grams: 80, isDefault: true }] }),
  f({ id: "esfiha-queijo", name: "Esfiha de queijo", category: "industrializados", synonyms: ["esfiha queijo"], kcal: 260, proteinG: 11.0, carbG: 26.0, fatG: 12.0, servings: [{ id: "s-unidade", label: "1 unidade", grams: 80, isDefault: true }] }),
  f({ id: "kibe-assado", name: "Kibe assado", category: "carnes", synonyms: ["quibe", "kibe"], kcal: 220, proteinG: 12.0, carbG: 18.0, fatG: 10.0, servings: [{ id: "s-unidade", label: "1 unidade", grams: 70, isDefault: true }] }),
  f({ id: "coxinha-grande", name: "Coxinha grande (lanchonete)", category: "industrializados", synonyms: ["coxinha grande"], kcal: 255, proteinG: 9.0, carbG: 25.0, fatG: 13.5, servings: [{ id: "s-unidade", label: "1 unidade", grams: 100, isDefault: true }] }),
  f({ id: "pastel-queijo", name: "Pastel de queijo", category: "industrializados", synonyms: ["pastel queijo"], kcal: 300, proteinG: 10.0, carbG: 27.0, fatG: 17.0, servings: [{ id: "s-unidade", label: "1 unidade", grams: 90, isDefault: true }] }),
  f({ id: "misto-quente", name: "Misto quente", category: "industrializados", synonyms: ["misto", "sanduíche misto"], kcal: 250, proteinG: 14.0, carbG: 22.0, fatG: 12.0, sodiumMg: 800, servings: [{ id: "s-unidade", label: "1 unidade", grams: 120, isDefault: true }] }),
  f({ id: "bauru-tradicional", name: "Bauru tradicional", category: "industrializados", synonyms: ["bauru"], kcal: 230, proteinG: 15.0, carbG: 20.0, fatG: 10.0, sodiumMg: 900, servings: [{ id: "s-unidade", label: "1 unidade", grams: 200, isDefault: true }] }),
  f({ id: "cafe-com-leite-padaria", name: "Café com leite (padaria)", category: "bebidas", synonyms: ["café com leite", "cafezinho"], kcal: 45, proteinG: 2.5, carbG: 5.0, fatG: 1.5, servings: [{ id: "s-xicara", label: "1 xícara", grams: 180, isDefault: true }] }),

  // Japonesa
  f({ id: "temaki-salmao", name: "Temaki de salmão", category: "peixes", synonyms: ["temaki", "temaki salmão"], kcal: 145, proteinG: 10.0, carbG: 18.0, fatG: 4.0, servings: [{ id: "s-unidade", label: "1 unidade", grams: 140, isDefault: true }] }),
  f({ id: "temaki-atum", name: "Temaki de atum", category: "peixes", synonyms: ["temaki atum"], kcal: 130, proteinG: 12.0, carbG: 16.0, fatG: 2.5, servings: [{ id: "s-unidade", label: "1 unidade", grams: 140, isDefault: true }] }),
  f({ id: "hot-roll-salmao", name: "Hot roll de salmão (8 peças)", category: "peixes", synonyms: ["hot roll", "hotroll"], kcal: 195, proteinG: 9.0, carbG: 20.0, fatG: 9.0, servings: [{ id: "s-porcao", label: "8 peças", grams: 200, isDefault: true }] }),
  f({ id: "hot-roll-camarao", name: "Hot roll de camarão (8 peças)", category: "peixes", synonyms: ["hot roll camarão"], kcal: 180, proteinG: 10.0, carbG: 19.0, fatG: 7.5, servings: [{ id: "s-porcao", label: "8 peças", grams: 200, isDefault: true }] }),
  f({ id: "sashimi-salmao", name: "Sashimi de salmão (10 fatias)", category: "peixes", synonyms: ["sashimi"], kcal: 180, proteinG: 22.0, carbG: 0, fatG: 10.0, servings: [{ id: "s-porcao", label: "10 fatias", grams: 120, isDefault: true }] }),
  f({ id: "combo-sushi-12", name: "Combo sushi (12 peças genérico)", category: "peixes", synonyms: ["combo sushi", "sushi combo"], kcal: 155, proteinG: 8.0, carbG: 22.0, fatG: 4.0, servings: [{ id: "s-combo", label: "1 combo", grams: 250, isDefault: true }] }),
  f({ id: "combo-sushi-20", name: "Combo sushi (20 peças genérico)", category: "peixes", synonyms: ["combo 20 peças"], kcal: 150, proteinG: 8.5, carbG: 21.0, fatG: 4.0, servings: [{ id: "s-combo", label: "1 combo", grams: 400, isDefault: true }] }),
  f({ id: "uramaki-filadelfia", name: "Uramaki Filadélfia (8 peças)", category: "peixes", synonyms: ["filadélfia", "philadelphia roll"], kcal: 175, proteinG: 8.0, carbG: 18.0, fatG: 8.0, servings: [{ id: "s-porcao", label: "8 peças", grams: 180, isDefault: true }] }),
  f({ id: "gyoza-frito", name: "Gyoza frito (6 unidades)", category: "industrializados", synonyms: ["gyoza", "guioza"], kcal: 210, proteinG: 9.0, carbG: 22.0, fatG: 9.5, servings: [{ id: "s-porcao", label: "6 unidades", grams: 120, isDefault: true }] }),
  f({ id: "missoshiro", name: "Missoshiru (miso soup)", category: "bebidas", synonyms: ["missô", "sopa miso"], kcal: 35, proteinG: 3.0, carbG: 4.0, fatG: 1.0, sodiumMg: 700, servings: [{ id: "s-tigela", label: "1 tigela", grams: 200, isDefault: true }] }),

  // Churrasco / espeto
  f({ id: "espeto-carne", name: "Espeto de carne", category: "carnes", synonyms: ["espetinho", "churrasco espeto"], kcal: 240, proteinG: 26.0, carbG: 0, fatG: 15.0, servings: [{ id: "s-espeto", label: "1 espeto", grams: 80, isDefault: true }] }),
  f({ id: "espeto-frango", name: "Espeto de frango", category: "aves", synonyms: ["espetinho frango"], kcal: 180, proteinG: 28.0, carbG: 0, fatG: 7.0, servings: [{ id: "s-espeto", label: "1 espeto", grams: 80, isDefault: true }] }),
  f({ id: "espeto-linguica", name: "Espeto de linguiça", category: "carnes", synonyms: ["espetinho linguiça"], kcal: 290, proteinG: 16.0, carbG: 2.0, fatG: 24.0, sodiumMg: 850, servings: [{ id: "s-espeto", label: "1 espeto", grams: 80, isDefault: true }] }),
  f({ id: "picanha-porcao-churrascaria", name: "Picanha (porção churrascaria)", category: "carnes", synonyms: ["picanha rodízio"], kcal: 280, proteinG: 25.0, carbG: 0, fatG: 20.0, servings: [{ id: "s-porcao", label: "1 porção", grams: 150, isDefault: true }] }),
  f({ id: "costela-porcao-churrasco", name: "Costela (porção churrasco)", category: "carnes", synonyms: ["costela churrasco"], kcal: 320, proteinG: 20.0, carbG: 0, fatG: 26.0, servings: [{ id: "s-porcao", label: "1 porção", grams: 180, isDefault: true }] }),
  f({ id: "farofa-churrasco", name: "Farofa de churrasco", category: "cereais", synonyms: ["farofa"], kcal: 280, proteinG: 4.0, carbG: 35.0, fatG: 14.0, servings: [{ id: "s-colher", label: "2 colheres", grams: 40, isDefault: true }] }),
  f({ id: "vinagrete-porcao", name: "Vinagrete (porção)", category: "hortalicas", synonyms: ["vinagrete"], kcal: 45, proteinG: 1.0, carbG: 6.0, fatG: 2.0, servings: [{ id: "s-porcao", label: "1 porção", grams: 80, isDefault: true }] }),

  // Açaí sizes
  f({ id: "acai-300ml", name: "Açaí 300 ml (com xarope)", category: "frutas", synonyms: ["açaí 300", "acai copo"], kcal: 145, proteinG: 2.0, carbG: 26.0, fatG: 4.0, sugarG: 22.0, servings: [{ id: "s-copo", label: "1 copo 300 ml", grams: 300, isDefault: true }] }),
  f({ id: "acai-500ml", name: "Açaí 500 ml (com xarope)", category: "frutas", synonyms: ["açaí 500", "acai médio"], kcal: 150, proteinG: 2.0, carbG: 27.0, fatG: 4.2, sugarG: 23.0, servings: [{ id: "s-copo", label: "1 copo 500 ml", grams: 500, isDefault: true }] }),
  f({ id: "acai-700ml", name: "Açaí 700 ml (com xarope)", category: "frutas", synonyms: ["açaí 700", "acai grande"], kcal: 155, proteinG: 2.2, carbG: 28.0, fatG: 4.5, sugarG: 24.0, servings: [{ id: "s-copo", label: "1 copo 700 ml", grams: 700, isDefault: true }] }),
  f({ id: "acai-granola-extra", name: "Granola (cobertura açaí)", category: "cereais", synonyms: ["granola cobertura"], kcal: 420, proteinG: 10.0, carbG: 65.0, fatG: 14.0, sugarG: 20.0, servings: [{ id: "s-colher", label: "2 colheres", grams: 30, isDefault: true }] }),
  f({ id: "acai-leite-condensado", name: "Leite condensado (cobertura açaí)", category: "laticinios", synonyms: ["cobertura condensado"], kcal: 321, proteinG: 7.8, carbG: 55.0, fatG: 7.5, sugarG: 55.0, servings: [{ id: "s-colher", label: "1 colher", grams: 20, isDefault: true }] }),

  // Poke / bowls
  f({ id: "poke-atum", name: "Poke de atum (genérico)", category: "peixes", synonyms: ["poke atum"], kcal: 135, proteinG: 13.0, carbG: 13.0, fatG: 3.5, servings: [{ id: "s-tigela", label: "1 tigela", grams: 350, isDefault: true }] }),
  f({ id: "poke-frango", name: "Poke de frango (genérico)", category: "aves", synonyms: ["poke frango"], kcal: 125, proteinG: 14.0, carbG: 12.0, fatG: 3.0, servings: [{ id: "s-tigela", label: "1 tigela", grams: 350, isDefault: true }] }),
  f({ id: "bowl-burrito", name: "Bowl burrito (genérico)", category: "outros", synonyms: ["burrito bowl", "mexican bowl"], kcal: 150, proteinG: 11.0, carbG: 16.0, fatG: 5.0, servings: [{ id: "s-tigela", label: "1 tigela", grams: 400, isDefault: true }] }),
  f({ id: "salad-bowl-frango", name: "Salad bowl de frango", category: "aves", synonyms: ["salad bowl", "salada bowl"], kcal: 110, proteinG: 12.0, carbG: 8.0, fatG: 3.5, servings: [{ id: "s-tigela", label: "1 tigela", grams: 350, isDefault: true }] }),

  // Lanches / burgers genéricos
  f({ id: "x-salada-generico", name: "X-salada (genérico)", category: "industrializados", synonyms: ["x-salada", "xis"], kcal: 230, proteinG: 13.0, carbG: 20.0, fatG: 11.0, sodiumMg: 700, servings: [{ id: "s-unidade", label: "1 unidade", grams: 250, isDefault: true }] }),
  f({ id: "x-bacon-generico", name: "X-bacon (genérico)", category: "industrializados", synonyms: ["x-bacon", "xis bacon"], kcal: 260, proteinG: 15.0, carbG: 18.0, fatG: 15.0, sodiumMg: 850, servings: [{ id: "s-unidade", label: "1 unidade", grams: 280, isDefault: true }] }),
  f({ id: "x-egg-generico", name: "X-egg (genérico)", category: "industrializados", synonyms: ["x-egg", "xis egg"], kcal: 245, proteinG: 15.0, carbG: 18.0, fatG: 13.0, sodiumMg: 750, servings: [{ id: "s-unidade", label: "1 unidade", grams: 270, isDefault: true }] }),
  f({ id: "hot-dog-simples", name: "Cachorro-quente simples", category: "industrializados", synonyms: ["hot dog", "dogão"], kcal: 240, proteinG: 10.0, carbG: 24.0, fatG: 12.0, sodiumMg: 900, servings: [{ id: "s-unidade", label: "1 unidade", grams: 180, isDefault: true }] }),
  f({ id: "hot-dog-completo", name: "Cachorro-quente completo", category: "industrializados", synonyms: ["hot dog completo"], kcal: 255, proteinG: 11.0, carbG: 26.0, fatG: 13.0, sodiumMg: 950, servings: [{ id: "s-unidade", label: "1 unidade", grams: 250, isDefault: true }] }),
  f({ id: "batata-frita-pequena", name: "Batata frita pequena", category: "tuberculos", synonyms: ["fritas P"], kcal: 312, proteinG: 3.4, carbG: 41.0, fatG: 15.0, sodiumMg: 380, servings: [{ id: "s-porcao", label: "1 porção P", grams: 100, isDefault: true }] }),
  f({ id: "batata-frita-grande", name: "Batata frita grande", category: "tuberculos", synonyms: ["fritas G"], kcal: 312, proteinG: 3.4, carbG: 41.0, fatG: 15.0, sodiumMg: 400, servings: [{ id: "s-porcao", label: "1 porção G", grams: 200, isDefault: true }] }),
  f({ id: "onion-rings", name: "Onion rings (porção)", category: "industrializados", synonyms: ["anel de cebola"], kcal: 280, proteinG: 4.0, carbG: 32.0, fatG: 15.0, sodiumMg: 450, servings: [{ id: "s-porcao", label: "1 porção", grams: 120, isDefault: true }] }),

  // Pizza / massa genéricos
  f({ id: "pizza-calabresa-fatia", name: "Pizza de calabresa (fatia)", category: "industrializados", synonyms: ["pizza calabresa"], kcal: 270, proteinG: 12.0, carbG: 30.0, fatG: 12.0, sodiumMg: 650, servings: [{ id: "s-fatia", label: "1 fatia", grams: 110, isDefault: true }] }),
  f({ id: "pizza-portuguesa-fatia", name: "Pizza portuguesa (fatia)", category: "industrializados", synonyms: ["pizza portuguesa"], kcal: 255, proteinG: 12.0, carbG: 28.0, fatG: 11.0, sodiumMg: 700, servings: [{ id: "s-fatia", label: "1 fatia", grams: 120, isDefault: true }] }),
  f({ id: "pizza-frango-catupiry-fatia", name: "Pizza frango com catupiry (fatia)", category: "industrializados", synonyms: ["pizza frango catupiry"], kcal: 260, proteinG: 13.0, carbG: 27.0, fatG: 12.0, sodiumMg: 680, servings: [{ id: "s-fatia", label: "1 fatia", grams: 115, isDefault: true }] }),
  f({ id: "lazanha-bolonhesa-porcao", name: "Lasanha à bolonhesa (porção rest.)", category: "industrializados", synonyms: ["lasanha bolonhesa"], kcal: 160, proteinG: 9.0, carbG: 14.0, fatG: 7.5, sodiumMg: 500, servings: [{ id: "s-porcao", label: "1 porção", grams: 300, isDefault: true }] }),
  f({ id: "nhoque-molho-vermelho", name: "Nhoque ao molho vermelho", category: "cereais", synonyms: ["nhoque"], kcal: 145, proteinG: 5.0, carbG: 24.0, fatG: 3.5, servings: [{ id: "s-prato", label: "1 prato", grams: 300, isDefault: true }] }),
  f({ id: "espaguete-alho-oleo", name: "Espaguete alho e óleo", category: "cereais", synonyms: ["alho e óleo", "aglio e olio"], kcal: 175, proteinG: 5.0, carbG: 24.0, fatG: 7.0, servings: [{ id: "s-prato", label: "1 prato", grams: 280, isDefault: true }] }),

  // Outros delivery BR
  f({ id: "marmita-carne", name: "Marmita de carne (genérica)", category: "carnes", synonyms: ["marmita carne"], kcal: 145, proteinG: 13.0, carbG: 12.0, fatG: 5.5, servings: [{ id: "s-marmita", label: "1 marmita", grams: 400, isDefault: true }] }),
  f({ id: "marmita-peixe", name: "Marmita de peixe (genérica)", category: "peixes", synonyms: ["marmita peixe"], kcal: 125, proteinG: 14.0, carbG: 11.0, fatG: 3.5, servings: [{ id: "s-marmita", label: "1 marmita", grams: 400, isDefault: true }] }),
  f({ id: "tapioca-queijo-presunto", name: "Tapioca queijo e presunto", category: "cereais", synonyms: ["tapioca recheada"], kcal: 220, proteinG: 12.0, carbG: 28.0, fatG: 7.0, sodiumMg: 600, servings: [{ id: "s-unidade", label: "1 unidade", grams: 150, isDefault: true }] }),
  f({ id: "crepe-frango", name: "Crepe de frango", category: "aves", synonyms: ["crepe"], kcal: 200, proteinG: 12.0, carbG: 20.0, fatG: 8.0, servings: [{ id: "s-unidade", label: "1 unidade", grams: 180, isDefault: true }] }),
  f({ id: "pastel-de-feira-carne", name: "Pastel de feira (carne)", category: "industrializados", synonyms: ["pastel de feira"], kcal: 295, proteinG: 9.5, carbG: 28.0, fatG: 16.5, servings: [{ id: "s-unidade", label: "1 unidade", grams: 100, isDefault: true }] }),
  f({ id: "churros-doce-leite", name: "Churros com doce de leite", category: "industrializados", synonyms: ["churros"], kcal: 340, proteinG: 5.0, carbG: 48.0, fatG: 14.0, sugarG: 22.0, servings: [{ id: "s-unidade", label: "2 unidades", grams: 80, isDefault: true }] }),
  f({ id: "refrigerante-lata", name: "Refrigerante (lata 350 ml)", category: "bebidas", synonyms: ["refri", "coca", "guaraná"], kcal: 42, proteinG: 0, carbG: 10.5, fatG: 0, sugarG: 10.5, servings: [{ id: "s-lata", label: "1 lata", grams: 350, isDefault: true }] }),
  f({ id: "suco-natural-copo", name: "Suco natural (copo rest.)", category: "bebidas", synonyms: ["suco natural"], kcal: 50, proteinG: 0.5, carbG: 12.0, fatG: 0.1, sugarG: 10.0, servings: [{ id: "s-copo", label: "1 copo", grams: 300, isDefault: true }] }),
];
