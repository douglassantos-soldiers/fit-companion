/**
 * One-shot generator — run: node scripts/gen-brands-ean.mjs
 * Output: src/data/foods-brands-ean.ts
 */
import { writeFileSync } from "node:fs";

const rows = [
  { ean: "7894900010015", name: "Coca-Cola Original lata", brand: "Coca-Cola", cat: "bebidas", kcal: 44, proteinG: 0, carbG: 10.6, fatG: 0, sugarG: 10.6, servings: [{ id: "s-lata", label: "1 lata (350 ml)", grams: 350, isDefault: true }] },
  { ean: "7894900027013", name: "Coca-Cola Original 2L", brand: "Coca-Cola", cat: "bebidas", kcal: 30, proteinG: 0, carbG: 7.4, fatG: 0, servings: [{ id: "s-copo", label: "1 copo (200 ml)", grams: 200, isDefault: true }] },
  { ean: "7891991000826", name: "Guarana Antarctica lata", brand: "Antarctica", cat: "bebidas", kcal: 30, proteinG: 0, carbG: 7.3, fatG: 0, sugarG: 7.3, servings: [{ id: "s-lata", label: "1 lata (350 ml)", grams: 350, isDefault: true }] },
  { ean: "7891991002646", name: "Guarana Antarctica 600ml", brand: "Antarctica", cat: "bebidas", kcal: 30, proteinG: 0, carbG: 7.3, fatG: 0, servings: [{ id: "s-garrafa", label: "1 garrafa (600 ml)", grams: 600, isDefault: true }] },
  { ean: "7894900030013", name: "Fanta Laranja lata", brand: "Fanta", cat: "bebidas", kcal: 40, proteinG: 0, carbG: 10, fatG: 0, sugarG: 10, servings: [{ id: "s-lata", label: "1 lata (350 ml)", grams: 350, isDefault: true }] },
  { ean: "7894900031515", name: "Fanta Laranja 2L", brand: "Fanta", cat: "bebidas", kcal: 45, proteinG: 0, carbG: 11, fatG: 0, servings: [{ id: "s-copo", label: "1 copo (200 ml)", grams: 200, isDefault: true }] },
  { ean: "7894900093001", name: "Fanta Guarana lata", brand: "Fanta", cat: "bebidas", kcal: 40, proteinG: 0, carbG: 10.3, fatG: 0, servings: [{ id: "s-lata", label: "1 lata (350 ml)", grams: 350, isDefault: true }] },
  { ean: "7894900681017", name: "Sprite limao lata", brand: "Sprite", cat: "bebidas", kcal: 41, proteinG: 0, carbG: 10.3, fatG: 0, servings: [{ id: "s-lata", label: "1 lata (350 ml)", grams: 350, isDefault: true }] },
  { ean: "7894900681000", name: "Sprite limao 2L", brand: "Sprite", cat: "bebidas", kcal: 42, proteinG: 0, carbG: 10.5, fatG: 0, servings: [{ id: "s-copo", label: "1 copo (200 ml)", grams: 200, isDefault: true }] },
  { ean: "7892840800000", name: "Pepsi 2L", brand: "Pepsi", cat: "bebidas", kcal: 28, proteinG: 0, carbG: 7, fatG: 0, sugarG: 6.9, servings: [{ id: "s-copo", label: "1 copo (200 ml)", grams: 200, isDefault: true }] },
  { ean: "7892840823986", name: "H2OH Limoneto", brand: "H2OH!", cat: "bebidas", kcal: 3, proteinG: 0, carbG: 0, fatG: 0, servings: [{ id: "s-garrafa", label: "1 garrafa (500 ml)", grams: 500, isDefault: true }] },
  { ean: "7891203010056", name: "Pao de forma Premium", brand: "Panco", cat: "cereais", kcal: 252, proteinG: 8.4, carbG: 50, fatG: 2.6, fiberG: 2.5, servings: [{ id: "s-fatia", label: "1 fatia", grams: 25, isDefault: true }, { id: "s-100g", label: "100 g", grams: 100 }] },
  { ean: "7896002360326", name: "Pao de forma tradicional Pullman", brand: "Pullman", cat: "cereais", kcal: 244, proteinG: 7.6, carbG: 48, fatG: 2.6, servings: [{ id: "s-fatia", label: "1 fatia", grams: 25, isDefault: true }] },
  { ean: "7896066301457", name: "Pao de forma integral Do Forno", brand: "Wickbold", cat: "cereais", kcal: 236, proteinG: 13.2, carbG: 36, fatG: 4.4, fiberG: 6, servings: [{ id: "s-fatia", label: "1 fatia", grams: 25, isDefault: true }] },
  { ean: "7896066301235", name: "Pao integral tradicional Wickbold", brand: "Wickbold", cat: "cereais", kcal: 246, proteinG: 14.2, carbG: 40, fatG: 3.2, fiberG: 6, servings: [{ id: "s-fatia", label: "1 fatia", grams: 25, isDefault: true }] },
  { ean: "7896066301778", name: "Pao de forma integral 550g", brand: "Wickbold", cat: "cereais", kcal: 240, proteinG: 11, carbG: 42, fatG: 3.2, servings: [{ id: "s-fatia", label: "1 fatia", grams: 25, isDefault: true }] },
  { ean: "7891962051338", name: "Pao de forma tradicional Visconti", brand: "Visconti", cat: "cereais", kcal: 275, proteinG: 9, carbG: 50, fatG: 4.3, servings: [{ id: "s-fatia", label: "1 fatia", grams: 25, isDefault: true }] },
  { ean: "7891962051345", name: "Pao de forma integral Visconti", brand: "Visconti", cat: "cereais", kcal: 269, proteinG: 8.7, carbG: 49, fatG: 4.2, fiberG: 5, servings: [{ id: "s-fatia", label: "1 fatia", grams: 25, isDefault: true }] },
  { ean: "7891962064048", name: "Pao de forma Bauducco", brand: "Bauducco", cat: "cereais", kcal: 276, proteinG: 9, carbG: 50, fatG: 4.4, servings: [{ id: "s-fatia", label: "1 fatia", grams: 25, isDefault: true }] },
  { ean: "7891962064055", name: "Pao integral Bauducco", brand: "Bauducco", cat: "cereais", kcal: 254, proteinG: 9.7, carbG: 45, fatG: 3.9, fiberG: 5, servings: [{ id: "s-fatia", label: "1 fatia", grams: 25, isDefault: true }] },
  { ean: "7891962067278", name: "Pao fermentacao natural multigraos", brand: "Bauducco", cat: "cereais", kcal: 256, proteinG: 12, carbG: 42, fatG: 4.4, fiberG: 5, servings: [{ id: "s-fatia", label: "1 fatia", grams: 30, isDefault: true }] },
  { ean: "7891962053189", name: "Torrada tradicional Bauducco", brand: "Bauducco", cat: "cereais", kcal: 377, proteinG: 11, carbG: 66.7, fatG: 7.3, servings: [{ id: "s-unidade", label: "2 torradas", grams: 20, isDefault: true }] },
  { ean: "7891962053196", name: "Torrada integral Bauducco", brand: "Bauducco", cat: "cereais", kcal: 381, proteinG: 14, carbG: 64, fatG: 7.7, fiberG: 6, servings: [{ id: "s-unidade", label: "2 torradas", grams: 20, isDefault: true }] },
  { ean: "7891962060460", name: "Torrada integral Bauducco pack", brand: "Bauducco", cat: "cereais", kcal: 389, proteinG: 12, carbG: 68, fatG: 7.7, servings: [{ id: "s-unidade", label: "2 torradas", grams: 20, isDefault: true }] },
  { ean: "7891962054810", name: "Cookies Bauducco", brand: "Bauducco", cat: "industrializados", kcal: 457, proteinG: 6.5, carbG: 70, fatG: 16.7, sugarG: 28, servings: [{ id: "s-unidade", label: "2 cookies", grams: 30, isDefault: true }] },
  { ean: "7896004004679", name: "Sucrilhos original", brand: "Kellogg's", cat: "cereais", kcal: 363, proteinG: 4.3, carbG: 86.7, fatG: 0, sugarG: 35, servings: [{ id: "s-xicara", label: "1 xicara (30 g)", grams: 30, isDefault: true }] },
  { ean: "7896004007427", name: "Sucrilhos original 240g", brand: "Kellogg's", cat: "cereais", kcal: 363, proteinG: 4, carbG: 86.7, fatG: 0, servings: [{ id: "s-xicara", label: "1 xicara (30 g)", grams: 30, isDefault: true }] },
  { ean: "7896004009377", name: "Sucrilhos 60% menos acucares", brand: "Kellogg's", cat: "cereais", kcal: 347, proteinG: 6.1, carbG: 80, fatG: 0.3, servings: [{ id: "s-xicara", label: "1 xicara (30 g)", grams: 30, isDefault: true }] },
  { ean: "7896004007342", name: "Sucrilhos original 690g", brand: "Kellogg's", cat: "cereais", kcal: 368, proteinG: 4.5, carbG: 87, fatG: 0, servings: [{ id: "s-xicara", label: "1 xicara (30 g)", grams: 30, isDefault: true }] },
  { ean: "7891000426210", name: "Nescau achocolatado em po", brand: "Nestle", cat: "industrializados", kcal: 380, proteinG: 3, carbG: 85, fatG: 2, sugarG: 75, fiberG: 4.5, servings: [{ id: "s-colher", label: "2 colheres de sopa", grams: 20, isDefault: true }] },
  { ean: "7891000379585", name: "Nescau em po", brand: "Nestle", cat: "industrializados", kcal: 380, proteinG: 3, carbG: 85, fatG: 2, sugarG: 75, servings: [{ id: "s-colher", label: "2 colheres de sopa", grams: 20, isDefault: true }] },
  { ean: "7891000258613", name: "Cereal matinal Duo Nescau", brand: "Nescau", cat: "cereais", kcal: 389, proteinG: 6.2, carbG: 76, fatG: 5.4, sugarG: 30, fiberG: 5.8, servings: [{ id: "s-xicara", label: "1 xicara (30 g)", grams: 30, isDefault: true }] },
  { ean: "7896051111016", name: "Leite integral longa vida Itambe", brand: "Itambe", cat: "laticinios", kcal: 59, proteinG: 3.3, carbG: 4.7, fatG: 3, sugarG: 4.7, servings: [{ id: "s-copo", label: "1 copo (200 ml)", grams: 200, isDefault: true }] },
  { ean: "7896051111030", name: "Leite integral Itambe", brand: "Itambe", cat: "laticinios", kcal: 66, proteinG: 3.3, carbG: 4.7, fatG: 3.5, sugarG: 4.7, servings: [{ id: "s-copo", label: "1 copo (200 ml)", grams: 200, isDefault: true }] },
  { ean: "7896051128069", name: "Leite NoLac zero lactose integral", brand: "Itambe", cat: "laticinios", kcal: 58, proteinG: 3.2, carbG: 4.5, fatG: 3, sugarG: 4.5, servings: [{ id: "s-copo", label: "1 copo (200 ml)", grams: 200, isDefault: true }] },
  { ean: "7896051111764", name: "Leite semidesnatado zero lactose", brand: "Itambe", cat: "laticinios", kcal: 39, proteinG: 3, carbG: 4.5, fatG: 1, sugarG: 4.5, servings: [{ id: "s-copo", label: "1 copo (200 ml)", grams: 200, isDefault: true }] },
  { ean: "7896051115014", name: "Leite condensado Itambe", brand: "Itambe", cat: "laticinios", kcal: 320, proteinG: 7, carbG: 55, fatG: 8, sugarG: 55, servings: [{ id: "s-colher", label: "1 colher de sopa", grams: 15, isDefault: true }] },
  { ean: "7896051164609", name: "Iogurte natural integral Itambe", brand: "Itambe", cat: "laticinios", kcal: 76, proteinG: 4.1, carbG: 6, fatG: 3.9, sugarG: 6, servings: [{ id: "s-pote", label: "1 pote (170 g)", grams: 170, isDefault: true }] },
  { ean: "7896051121251", name: "Iogurte natural integral Itambe pote", brand: "Itambe", cat: "laticinios", kcal: 74, proteinG: 4.5, carbG: 5.9, fatG: 3.5, sugarG: 5.9, servings: [{ id: "s-pote", label: "1 pote (170 g)", grams: 170, isDefault: true }] },
  { ean: "7896051140108", name: "Requeijao light Itambe", brand: "Itambe", cat: "laticinios", kcal: 160, proteinG: 13.3, carbG: 0, fatG: 11, servings: [{ id: "s-colher", label: "1 colher de sopa", grams: 30, isDefault: true }] },
  { ean: "7891030002354", name: "Leite Mococa", brand: "Mococa", cat: "laticinios", kcal: 58, proteinG: 3.2, carbG: 4.6, fatG: 3, sugarG: 4.6, servings: [{ id: "s-copo", label: "1 copo (200 ml)", grams: 200, isDefault: true }] },
  { ean: "7891030300290", name: "Leite condensado Mococa", brand: "Mococa", cat: "laticinios", kcal: 330, proteinG: 7.5, carbG: 55, fatG: 8, sugarG: 55, servings: [{ id: "s-colher", label: "1 colher de sopa", grams: 15, isDefault: true }] },
  { ean: "7891030003467", name: "Creme de leite leve UHT", brand: "Mococa", cat: "laticinios", kcal: 162, proteinG: 3.1, carbG: 4.3, fatG: 15, sugarG: 4.3, servings: [{ id: "s-colher", label: "1 colher de sopa", grams: 20, isDefault: true }] },
  { ean: "7891025120230", name: "Iogurte natural integral Danone", brand: "Danone", cat: "laticinios", kcal: 76, proteinG: 4.7, carbG: 6.3, fatG: 3.6, sugarG: 6.3, servings: [{ id: "s-pote", label: "1 pote (160 g)", grams: 160, isDefault: true }] },
  { ean: "7891025120223", name: "Iogurte natural desnatado Danone", brand: "Danone", cat: "laticinios", kcal: 53, proteinG: 5.6, carbG: 7.5, fatG: 0, sugarG: 7.5, servings: [{ id: "s-pote", label: "1 pote (160 g)", grams: 160, isDefault: true }] },
  { ean: "7891025118541", name: "Iogurte natural Danone", brand: "Danone", cat: "laticinios", kcal: 77, proteinG: 4.7, carbG: 6.5, fatG: 3.6, servings: [{ id: "s-pote", label: "1 pote (160 g)", grams: 160, isDefault: true }] },
  { ean: "7891025124603", name: "Iogurte natural zero lactose Danone", brand: "Danone", cat: "laticinios", kcal: 56, proteinG: 6.3, carbG: 5.4, fatG: 1, sugarG: 5.4, servings: [{ id: "s-pote", label: "1 pote (160 g)", grams: 160, isDefault: true }] },
  { ean: "7891025123552", name: "YoPRO Natural 17g proteina", brand: "Danone", cat: "laticinios", kcal: 90, proteinG: 17, carbG: 5.1, fatG: 0, sugarG: 3.2, servings: [{ id: "s-pote", label: "1 pote (160 g)", grams: 160, isDefault: true }] },
  { ean: "7891025699880", name: "Requeijao cremoso Danone", brand: "Danone", cat: "laticinios", kcal: 253, proteinG: 10.3, carbG: 4.7, fatG: 21.3, servings: [{ id: "s-colher", label: "1 colher de sopa", grams: 30, isDefault: true }] },
  { ean: "7891000084649", name: "Requeijao Nestle tradicional", brand: "Nestle", cat: "laticinios", kcal: 260, proteinG: 9, carbG: 4.2, fatG: 23, servings: [{ id: "s-colher", label: "1 colher de sopa", grams: 30, isDefault: true }] },
  { ean: "7891999144485", name: "Requeijao Vigor", brand: "Vigor", cat: "laticinios", kcal: 273, proteinG: 9, carbG: 3, fatG: 25, servings: [{ id: "s-colher", label: "1 colher de sopa", grams: 30, isDefault: true }] },
  { ean: "7896625211395", name: "Requeijao cremoso light Vigor", brand: "Vigor", cat: "laticinios", kcal: 143, proteinG: 11, carbG: 4, fatG: 9.2, servings: [{ id: "s-colher", label: "1 colher de sopa", grams: 30, isDefault: true }] },
  { ean: "7896030518027", name: "Requeijao cremoso Tirolez", brand: "Tirolez", cat: "laticinios", kcal: 253, proteinG: 5.7, carbG: 1.7, fatG: 25, servings: [{ id: "s-colher", label: "1 colher de sopa", grams: 30, isDefault: true }] },
  { ean: "7896256600551", name: "Queijo prato fatiado Tirol", brand: "Tirol", cat: "laticinios", kcal: 352, proteinG: 25, carbG: 0, fatG: 28, servings: [{ id: "s-fatia", label: "1 fatia", grams: 20, isDefault: true }] },
  { ean: "7898215150657", name: "Queijo prato fatiado Piracanjuba", brand: "Piracanjuba", cat: "laticinios", kcal: 337, proteinG: 22.7, carbG: 0, fatG: 27.3, servings: [{ id: "s-fatia", label: "1 fatia", grams: 20, isDefault: true }] },
  { ean: "7891143001077", name: "Queijo processado prato Polenghi", brand: "Polenghi", cat: "laticinios", kcal: 277, proteinG: 13, carbG: 6, fatG: 22.3, servings: [{ id: "s-fatia", label: "1 fatia", grams: 20, isDefault: true }] },
  { ean: "7898955617519", name: "Queijo prato President", brand: "President", cat: "laticinios", kcal: 343, proteinG: 28, carbG: 2, fatG: 25, servings: [{ id: "s-fatia", label: "1 fatia", grams: 20, isDefault: true }] },
  { ean: "7891156001040", name: "Yakult leite fermentado", brand: "Yakult", cat: "laticinios", kcal: 64, proteinG: 2.1, carbG: 13.8, fatG: 0, sugarG: 13.8, servings: [{ id: "s-frasco", label: "1 frasco (80 g)", grams: 80, isDefault: true }] },
  { ean: "7891156002030", name: "Yakult 40 leite fermentado", brand: "Yakult", cat: "laticinios", kcal: 64, proteinG: 2.1, carbG: 13.8, fatG: 0, sugarG: 13.8, servings: [{ id: "s-frasco", label: "1 frasco (80 g)", grams: 80, isDefault: true }] },
  { ean: "7622300990732", name: "Biscoito Club Social original", brand: "Club Social", cat: "industrializados", kcal: 447, proteinG: 8, carbG: 63, fatG: 18, servings: [{ id: "s-pacote", label: "1 pacotinho (26 g)", grams: 26, isDefault: true }] },
  { ean: "7622300990701", name: "Club Social original", brand: "Club Social", cat: "industrializados", kcal: 450, proteinG: 7.9, carbG: 62.5, fatG: 18.3, servings: [{ id: "s-pacote", label: "1 pacotinho (26 g)", grams: 26, isDefault: true }] },
  { ean: "7622300992286", name: "Club Social integral", brand: "Club Social", cat: "industrializados", kcal: 463, proteinG: 8.8, carbG: 70.8, fatG: 16.3, fiberG: 4, servings: [{ id: "s-pacote", label: "1 pacotinho (26 g)", grams: 26, isDefault: true }] },
  { ean: "7622210568823", name: "Club Social cebola e sour cream", brand: "Club Social", cat: "industrializados", kcal: 426, proteinG: 8.5, carbG: 63.8, fatG: 14.9, servings: [{ id: "s-pacote", label: "1 pacotinho (26 g)", grams: 26, isDefault: true }] },
  { ean: "7898641070338", name: "Whey protein concentrado Dux", brand: "Dux", cat: "suplementos", kcal: 407, proteinG: 71.4, carbG: 12.9, fatG: 7.1, servings: [{ id: "s-scoop", label: "1 scoop (30 g)", grams: 30, isDefault: true }] },
  { ean: "7898641070345", name: "Whey protein Dux chocolate", brand: "Dux", cat: "suplementos", kcal: 407, proteinG: 66.7, carbG: 18, fatG: 7.7, servings: [{ id: "s-scoop", label: "1 scoop (30 g)", grams: 30, isDefault: true }] },
  { ean: "7898641074701", name: "Whey protein concentrado Dux pote", brand: "Dux", cat: "suplementos", kcal: 423, proteinG: 66.7, carbG: 21.7, fatG: 7.7, servings: [{ id: "s-scoop", label: "1 scoop (30 g)", grams: 30, isDefault: true }] },
  { ean: "7898641074503", name: "Whey shake chocolate branco pronto", brand: "Dux", cat: "suplementos", kcal: 46, proteinG: 6, carbG: 4.4, fatG: 0.4, servings: [{ id: "s-garrafa", label: "1 garrafa (250 ml)", grams: 250, isDefault: true }] },
  { ean: "7899941201811", name: "100% Whey Max Titanium morango", brand: "Max Titanium", cat: "suplementos", kcal: 427, proteinG: 70, carbG: 18.7, fatG: 8, servings: [{ id: "s-scoop", label: "1 scoop (30 g)", grams: 30, isDefault: true }] },
  { ean: "7898930772080", name: "Whey protein Growth", brand: "Growth", cat: "suplementos", kcal: 423, proteinG: 76.7, carbG: 14, fatG: 6.7, servings: [{ id: "s-scoop", label: "1 scoop (30 g)", grams: 30, isDefault: true }] },
  { ean: "7898965398194", name: "Whey protein Shark Pro", brand: "Shark Pro", cat: "suplementos", kcal: 385, proteinG: 65, carbG: 19.8, fatG: 4.8, servings: [{ id: "s-scoop", label: "1 scoop (30 g)", grams: 30, isDefault: true }] },
  { ean: "7896798603188", name: "Protein+ Banoffee", brand: "Banana Brasil", cat: "suplementos", kcal: 362, proteinG: 32, carbG: 32, fatG: 15, fiberG: 10.6, servings: [{ id: "s-barra", label: "1 barra (45 g)", grams: 45, isDefault: true }] },
  { ean: "7896798603225", name: "Protein+ torta de limao", brand: "Banana Brasil", cat: "suplementos", kcal: 360, proteinG: 32, carbG: 32, fatG: 15, fiberG: 10.6, servings: [{ id: "s-barra", label: "1 barra (45 g)", grams: 45, isDefault: true }] },
  { ean: "7894904082728", name: "Lasanha 4 queijos Seara", brand: "Seara", cat: "industrializados", kcal: 122, proteinG: 3.6, carbG: 14, fatG: 5.6, servings: [{ id: "s-porcao", label: "1 porcao (200 g)", grams: 200, isDefault: true }] },
  { ean: "7892840823467", name: "Cheetos Onda requeijao", brand: "Cheetos", cat: "industrializados", kcal: 476, proteinG: 5, carbG: 64.8, fatG: 21.9, servings: [{ id: "s-porcao", label: "1 porcao (30 g)", grams: 30, isDefault: true }] },
];

function slug(s) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function servingLit(list) {
  return `[${list
    .map(
      (s) =>
        `{ id: '${esc(s.id)}', label: '${esc(s.label)}', grams: ${s.grams}${s.isDefault ? ", isDefault: true" : ""} }`,
    )
    .join(", ")}]`;
}

const seen = new Set();
const lines = [
  "/**",
  " * Branded BR SKUs with real GTINs (curated from public rotulo / OFF BR data).",
  " * source: internal. EANs are real — never invent barcodes.",
  " * OFF remains barcode fallback only, not search SoT.",
  " */",
  "/* eslint-disable prettier/prettier -- compact FoodDef rows */",
  'import { INTERNAL_SOURCE_VERSION, type FoodDef } from "@/data/foods-helpers";',
  "",
  "function f(d: Omit<FoodDef, \"sourceVersion\">): FoodDef {",
  "  return { ...d, sourceVersion: INTERNAL_SOURCE_VERSION };",
  "}",
  "",
  "export const FOOD_DEFS_BRANDS_EAN: FoodDef[] = [",
];

for (const r of rows) {
  if (seen.has(r.ean)) continue;
  seen.add(r.ean);
  const id = `br-${slug(`${r.brand}-${r.name}`)}`;
  const syn = JSON.stringify([r.brand, r.name.split(" ")[0]].filter(Boolean));
  const extras = [];
  if (r.fiberG != null) extras.push(`fiberG: ${r.fiberG}`);
  if (r.sugarG != null) extras.push(`sugarG: ${r.sugarG}`);
  const extraStr = extras.length ? `, ${extras.join(", ")}` : "";
  lines.push(
    `  f({ id: '${id}', name: '${esc(r.name)}', category: '${r.cat}', brand: '${esc(r.brand)}', ean: '${r.ean}', synonyms: ${syn}, kcal: ${r.kcal}, proteinG: ${r.proteinG}, carbG: ${r.carbG}, fatG: ${r.fatG}${extraStr}, servings: ${servingLit(r.servings)} }),`,
  );
}
lines.push("];", "");

writeFileSync("src/data/foods-brands-ean.ts", lines.join("\n"), "utf8");
console.log(`OK: ${seen.size} branded foods`);
