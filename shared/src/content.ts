// Question banks. Add more entries freely - the engine picks at random.
export interface Question {cat: string; q: string; answer: string; wrong: string[]}
const RAW = `Geography|Capital of Australia?|Canberra|Sydney|Melbourne|Perth
Geography|Longest river in Africa?|Nile|Congo|Niger|Zambezi
Geography|Most populous country (2024)?|India|China|USA|Indonesia
Geography|Mount Kilimanjaro is in which country?|Tanzania|Kenya|Uganda|Ethiopia
Geography|Smallest country in the world?|Vatican City|Monaco|Malta|Nauru
Science|Chemical symbol for gold?|Au|Ag|Gd|Go
Science|Which planet has the most moons?|Saturn|Jupiter|Uranus|Neptune
Science|Bones in the adult human body?|206|186|256|312
Science|Hardest natural substance?|Diamond|Quartz|Steel|Topaz
Science|Speed of light is about...|300,000 km/s|30,000 km/s|3,000,000 km/s|150,000 km/s
History|Year the Berlin Wall fell?|1989|1979|1991|1985
History|Who painted the Mona Lisa?|Leonardo da Vinci|Michelangelo|Raphael|Botticelli
History|First person on the Moon?|Neil Armstrong|Buzz Aldrin|Yuri Gagarin|John Glenn
History|Only ancient wonder still standing?|Great Pyramid of Giza|Colossus of Rhodes|Hanging Gardens|Lighthouse of Alexandria
History|The Titanic sank in which year?|1912|1905|1921|1898
Pop Culture|Who wrote Romeo and Juliet?|Shakespeare|Dickens|Austen|Marlowe
Pop Culture|Which film features Simba?|The Lion King|Bambi|Madagascar|Tarzan
Sport|Players per side on a football (soccer) pitch?|11|9|10|12
Sport|Which sport uses a shuttlecock?|Badminton|Squash|Tennis|Croquet
Pop Culture|Wizard school in Harry Potter?|Hogwarts|Beauxbatons|Durmstrang|Ilvermorny
Food|Main ingredient of guacamole?|Avocado|Pea|Lime|Tomato
Food|Which country is sushi from?|Japan|China|Korea|Thailand
Food|Pasta whose name means "little worms"?|Vermicelli|Penne|Farfalle|Orzo
Nature|Fastest land animal?|Cheetah|Lion|Pronghorn|Greyhound
Nature|How many legs does a spider have?|8|6|10|12`;
export const QUESTIONS: Question[] = RAW.split('\n').map(l => { const f = l.split('|'); return {cat: f[0], q: f[1], answer: f[2], wrong: f.slice(3)}; });
export const SONGS: {genre: string; clue: string; answer: string}[] = [
 {
  "genre": "Pop",
  "clue": "Michael Jackson, 1982: a woman claims he is the father of her child",
  "answer": "Billie Jean"
 },
 {
  "genre": "Pop",
  "clue": "Adele, 2015: comeback single that opened her album 25",
  "answer": "Hello"
 },
 {
  "genre": "Pop",
  "clue": "Harry Styles, 2020: a juicy summer fruit in the title",
  "answer": "Watermelon Sugar"
 },
 {
  "genre": "Pop",
  "clue": "Ed Sheeran, 2017: named after a geometric outline",
  "answer": "Shape of You"
 },
 {
  "genre": "Pop",
  "clue": "Dua Lipa, 2020: a retro-disco opener telling an ex to stop",
  "answer": "Dont Start Now"
 },
 {
  "genre": "Rock",
  "clue": "Queen, 1975: six minutes with an opera section in the middle",
  "answer": "Bohemian Rhapsody"
 },
 {
  "genre": "Rock",
  "clue": "Led Zeppelin, 1971: builds from folk to hard rock, 8 minutes",
  "answer": "Stairway to Heaven"
 },
 {
  "genre": "Rock",
  "clue": "Nirvana, 1991: grunge breakthrough named after a deodorant",
  "answer": "Smells Like Teen Spirit"
 },
 {
  "genre": "Rock",
  "clue": "Eagles, 1976: a lovely place you can check out of but never leave",
  "answer": "Hotel California"
 },
 {
  "genre": "Rock",
  "clue": "AC/DC, 1979: the road trip with the worst destination",
  "answer": "Highway to Hell"
 },
 {
  "genre": "Hip-Hop",
  "clue": "Eminem, 2002: Oscar-winning song from the film 8 Mile",
  "answer": "Lose Yourself"
 },
 {
  "genre": "Hip-Hop",
  "clue": "Sugarhill Gang, 1979: the first rap hit to chart widely",
  "answer": "Rappers Delight"
 },
 {
  "genre": "Hip-Hop",
  "clue": "Outkast, 2003: exclamation title, a Grammy-winning crossover",
  "answer": "Hey Ya"
 },
 {
  "genre": "Hip-Hop",
  "clue": "Kendrick Lamar, 2017: a virtue, with a full stop in the title",
  "answer": "HUMBLE"
 },
 {
  "genre": "Hip-Hop",
  "clue": "The Notorious B.I.G., 1994: rags-to-riches debut single",
  "answer": "Juicy"
 },
 {
  "genre": "Dance",
  "clue": "Daft Punk, 2013: robot duo with Pharrell and Nile Rodgers",
  "answer": "Get Lucky"
 },
 {
  "genre": "Dance",
  "clue": "Avicii, 2013: country-flavoured EDM with Aloe Blacc",
  "answer": "Wake Me Up"
 },
 {
  "genre": "Dance",
  "clue": "Swedish House Mafia, 2011: reassuring a child about everything",
  "answer": "Dont You Worry Child"
 },
 {
  "genre": "Dance",
  "clue": "Robyn, 2010: a solo dancefloor heartbreak anthem",
  "answer": "Dancing On My Own"
 },
 {
  "genre": "Dance",
  "clue": "Calvin Harris and Rihanna, 2016: the reason you came",
  "answer": "This Is What You Came For"
 }
];
export const WORDS = ['PLANE', 'BREAD', 'CHAIR', 'LIGHT', 'MUSIC', 'TIGER', 'OCEAN', 'STORM'];
export const PHRASES = [{hint: 'IDIOM', phrase: 'BREAK THE ICE'}, {hint: 'MOVIE', phrase: 'THE LION KING'}, {hint: 'LANDMARK', phrase: 'EIFFEL TOWER'}, {hint: 'PROVERB', phrase: 'ACTIONS SPEAK LOUDER'}, {hint: 'FOOD', phrase: 'CHOCOLATE CAKE'}];
