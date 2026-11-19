/**
 * The places of the bundled trip: five days in Lisbon.
 *
 * Sights are real public landmarks at their real coordinates. Their opening hours, visit lengths and ticket prices
 * are made up for the example. Every hotel and restaurant is fictional: invented names at invented spots in real
 * neighbourhoods, with invented prices. None of them is a real business.
 */

export type Category = "sight" | "food" | "stay";

export interface Place {
  id: string;
  name: string;
  category: Category;
  /** The neighbourhood, for lists. */
  area: string;
  lat: number;
  lng: number;
  /** Opening hours as people read them. */
  hours: string;
  /** A typical visit, in minutes (a night for a hotel). */
  visitMin: number;
  /** In euros: a ticket, a typical meal for one, or a night for a hotel. 0 is free. */
  price: number;
  notes: string;
  /** A made-up business (every hotel and restaurant here). */
  fictional: boolean;
  /** A few words of what it is ("Viewpoint", "Bakery"). */
  kind: string;
}

const sight = (
  id: string,
  name: string,
  area: string,
  lat: number,
  lng: number,
  kind: string,
  visitMin: number,
  price: number,
  hours: string,
  notes: string,
): Place => ({
  id,
  name,
  category: "sight",
  area,
  lat,
  lng,
  kind,
  visitMin,
  price,
  hours,
  notes,
  fictional: false,
});

const made = (
  category: "food" | "stay",
  id: string,
  name: string,
  area: string,
  lat: number,
  lng: number,
  kind: string,
  price: number,
  hours: string,
  notes: string,
  visitMin = category === "food" ? 60 : 0,
): Place => ({
  id,
  name,
  category,
  area,
  lat,
  lng,
  kind,
  visitMin,
  price,
  hours,
  notes,
  fictional: true,
});

export const PLACES: readonly Place[] = [
  // Belém, by the river
  sight("torre-belem", "Torre de Belém", "Belém", 38.69157, -9.21598, "Fortress", 60, 8, "10:00 to 18:00, closed Mondays", "A small fortified tower at the water's edge. The queue moves faster before eleven."),
  sight("jeronimos", "Mosteiro dos Jerónimos", "Belém", 38.69785, -9.20654, "Monastery", 90, 12, "10:00 to 18:00, closed Mondays", "The cloister is the part to see. The church itself is free."),
  sight("padrao", "Padrão dos Descobrimentos", "Belém", 38.69363, -9.20573, "Monument", 40, 6, "10:00 to 19:00", "Take the lift to the top for the view over the river and the compass rose below."),
  sight("jardim-tropical", "Jardim Botânico Tropical", "Belém", 38.69763, -9.20319, "Garden", 45, 3, "10:00 to 19:00", "A quiet garden of palms and ponds, behind the monastery."),
  sight("maat", "MAAT", "Belém", 38.69596, -9.1946, "Museum", 75, 11, "10:00 to 19:00, closed Tuesdays", "Walk over the curved roof for free, whether or not you go in."),
  sight("lx-factory", "LX Factory", "Alcântara", 38.70318, -9.1786, "Old factory", 75, 0, "Shops from 10:00, bars late", "Old printworks turned into shops and cafés under the bridge."),
  sight("mnaa", "Museu Nacional de Arte Antiga", "Madragoa", 38.70497, -9.16101, "Museum", 90, 10, "10:00 to 18:00, closed Mondays", "Portuguese painting and the Japanese screens. The garden café looks over the docks."),
  // Estrela and the west
  sight("estrela", "Basílica da Estrela", "Estrela", 38.71314, -9.16021, "Church", 30, 0, "07:30 to 20:00", "Climb to the dome for a small fee, paid at the door."),
  sight("jardim-estrela", "Jardim da Estrela", "Estrela", 38.71377, -9.15943, "Park", 30, 0, "07:00 to 24:00", "A shaded park opposite the basilica, with a bandstand and a kiosk."),
  sight("aqueduto", "Aqueduto das Águas Livres", "Campolide", 38.72705, -9.17212, "Aqueduct", 45, 6, "10:00 to 17:30, closed Sundays", "Walk along the top of the arches. Wind can close it."),
  // Chiado and Bairro Alto
  sight("ribeira", "Mercado da Ribeira", "Cais do Sodré", 38.70693, -9.14588, "Market hall", 45, 0, "Mornings for the fresh market", "The old market hall. Come early for the fish and flower stalls."),
  sight("carmo", "Convento do Carmo", "Chiado", 38.71203, -9.14063, "Ruin", 40, 7, "10:00 to 19:00, closed Sundays", "A church left roofless by the 1755 earthquake, with a small museum."),
  sight("santa-justa", "Elevador de Santa Justa", "Baixa", 38.71208, -9.1394, "Lift", 20, 6, "07:30 to 23:00", "An iron lift from the Baixa up to Carmo. The view deck is the point."),
  sight("sao-pedro", "Miradouro de São Pedro de Alcântara", "Bairro Alto", 38.7154, -9.14438, "Viewpoint", 25, 0, "Open all day", "A terrace garden looking across to the castle."),
  // Baixa
  sight("rossio", "Rossio", "Baixa", 38.71394, -9.13915, "Square", 20, 0, "Open all day", "The busy square with the wave-patterned paving."),
  sight("arco-augusta", "Arco da Rua Augusta", "Baixa", 38.70847, -9.13655, "Arch", 25, 3.5, "10:00 to 19:00", "A short climb to the top of the arch over the square."),
  sight("comercio", "Praça do Comércio", "Baixa", 38.70754, -9.13649, "Square", 30, 0, "Open all day", "The great riverfront square. Walk down to the steps at the water."),
  // Alfama, the castle and Graça
  sight("se", "Sé de Lisboa", "Alfama", 38.70977, -9.13339, "Cathedral", 35, 5, "09:30 to 19:00", "The city's cathedral. The cloister excavations cost a little extra."),
  sight("santa-luzia", "Miradouro de Santa Luzia", "Alfama", 38.71183, -9.13029, "Viewpoint", 20, 0, "Open all day", "Tiled walls and bougainvillea over the Alfama roofs."),
  sight("castelo", "Castelo de São Jorge", "Castelo", 38.71391, -9.13342, "Castle", 90, 15, "09:00 to 21:00", "Walk the walls at sunset. It is a steep climb from the Baixa."),
  sight("fado-museu", "Museu do Fado", "Alfama", 38.71049, -9.12732, "Museum", 50, 5, "10:00 to 18:00, closed Mondays", "Fado's story, with headphones to listen as you go."),
  sight("panteao", "Panteão Nacional", "São Vicente", 38.71509, -9.12465, "Monument", 40, 8, "10:00 to 17:00, closed Mondays", "Climb to the terrace around the white dome."),
  sight("feira-ladra", "Feira da Ladra", "São Vicente", 38.71499, -9.12594, "Flea market", 45, 0, "Tuesdays and Saturdays, mornings", "The flea market on Campo de Santa Clara."),
  sight("graca", "Miradouro da Graça", "Graça", 38.71623, -9.13127, "Viewpoint", 20, 0, "Open all day", "Pine trees, a kiosk and the castle across the valley."),
  sight("senhora-monte", "Miradouro da Senhora do Monte", "Graça", 38.71913, -9.13261, "Viewpoint", 20, 0, "Open all day", "The highest viewpoint in the old town. Best at sunset."),
  sight("azulejo", "Museu Nacional do Azulejo", "Xabregas", 38.72475, -9.11367, "Museum", 80, 8, "10:00 to 18:00, closed Mondays", "Five centuries of painted tiles in a former convent."),
  // Avenidas and the east
  sight("eduardo-vii", "Parque Eduardo VII", "Avenidas", 38.72867, -9.15367, "Park", 40, 0, "Open all day", "The long formal park. The greenhouses on the west side charge a small fee."),
  sight("gulbenkian", "Museu Calouste Gulbenkian", "Avenidas", 38.73719, -9.15441, "Museum", 100, 14, "10:00 to 18:00, closed Tuesdays", "A fine collection in a garden worth an hour on its own."),
  sight("oceanario", "Oceanário de Lisboa", "Parque das Nações", 38.76354, -9.09379, "Aquarium", 120, 25, "10:00 to 20:00", "One great central tank seen from every side."),

  // Where to stay: every one is fictional.
  made("stay", "h-ribeira", "Ribeira Loft Rooms", "Cais do Sodré", 38.7074, -9.1449, "Guesthouse", 109, "Check in from 15:00", "Six rooms above a tile shop, two minutes from the trains and ferries."),
  made("stay", "h-alfama", "Pátio das Gaivotas", "Alfama", 38.7112, -9.1287, "Small hotel", 128, "Check in from 14:00", "Rooms around a whitewashed courtyard. Steep lanes in every direction."),
  made("stay", "h-baixa", "Hotel Corda Azul", "Baixa", 38.7109, -9.1378, "Hotel", 152, "Check in from 15:00", "A plain, quiet hotel on a pedestrian street in the grid of the Baixa."),
  made("stay", "h-graca", "Graça Terrace Inn", "Graça", 38.7172, -9.1306, "Guesthouse", 88, "Check in from 16:00", "Simple rooms and a roof terrace. The 28 tram passes the corner."),
  made("stay", "h-estrela", "Casa Estrela Verde", "Estrela", 38.7128, -9.1572, "Guesthouse", 96, "Check in from 15:00", "A family house by the park, away from the busy streets."),
  made("stay", "h-belem", "Belém Rio Suites", "Belém", 38.6967, -9.2008, "Apartments", 118, "Check in from 15:00", "Apartments with kitchens, near the monastery and far from the centre."),
  made("stay", "h-avenida", "Avenida Linho Hotel", "Avenida", 38.7211, -9.1456, "Hotel", 174, "Check in from 14:00", "A larger hotel on the main avenue, with a pool on the roof."),

  // Where to eat: every one is fictional.
  made("food", "f-bica", "Bica Lenta Café", "Baixa", 38.7101, -9.1386, "Café", 7, "08:00 to 19:00", "Coffee and custard tarts at the counter.", 30),
  made("food", "f-pombo", "Tasca do Pombo", "Alfama", 38.7108, -9.1301, "Tavern", 18, "12:00 to 23:00, closed Sundays", "Grilled fish and a short handwritten menu. Cash only."),
  made("food", "f-graca", "Mesa da Graça", "Graça", 38.7161, -9.1317, "Restaurant", 24, "19:00 to 23:30", "Slow-cooked pork and clams on a terrace by the viewpoint.", 75),
  made("food", "f-brasa", "Sal e Brasa", "Cais do Sodré", 38.7067, -9.1437, "Grill", 28, "12:30 to 23:00", "Charcoal-grilled meat and fish near the river.", 75),
  made("food", "f-forno", "Forno de Belém", "Belém", 38.6974, -9.2024, "Bakery", 6, "08:00 to 20:00", "Warm pastries and strong coffee, opposite the monastery.", 30),
  made("food", "f-cais", "Cais Verde Kitchen", "Belém", 38.6963, -9.1986, "Lunch", 22, "12:00 to 17:00", "Salads and grilled sardines on a terrace by the water."),
  made("food", "f-lanterna", "Lanterna Petiscos", "Bairro Alto", 38.7135, -9.1452, "Small plates", 20, "18:00 to 01:00", "Small plates to share, on a narrow street that fills up late."),
  made("food", "f-pao", "Pão da Estrela", "Estrela", 38.7139, -9.1579, "Bakery", 9, "07:30 to 19:00", "Bread, sandwiches and soup by the park.", 30),
  made("food", "f-azulejo", "Azulejo Lunch Room", "Xabregas", 38.7241, -9.1149, "Lunch", 14, "12:00 to 16:00", "A set lunch in a tiled room near the museum."),
  made("food", "f-cantina", "Avenida Cantina", "Avenidas", 38.7352, -9.1501, "Canteen", 16, "11:30 to 22:00", "Soup, a main and coffee at a fixed price."),
  made("food", "f-doca", "Doca Oito", "Parque das Nações", 38.7621, -9.0951, "Restaurant", 26, "12:00 to 23:00", "Seafood rice by the old docks, next to the aquarium.", 75),
];

const byId = new Map(PLACES.map((p) => [p.id, p]));

export const placeById = (id: string): Place | undefined => byId.get(id);

/** A place we know, or a clear error for a programming mistake. */
export function mustPlace(id: string): Place {
  const p = byId.get(id);
  if (!p) throw new Error(`No place called ${id}`);
  return p;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  sight: "Sights",
  food: "Food",
  stay: "Stays",
};

export const CATEGORY_ONE: Record<Category, string> = {
  sight: "Sight",
  food: "Food",
  stay: "Stay",
};
