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
Science|What is the hardest natural substance?|Diamond|Quartz|Granite|Topaz
Science|Which gas do plants absorb from the air?|Carbon dioxide|Oxygen|Nitrogen|Hydrogen
Science|What is the center of an atom called?|Nucleus|Electron|Proton|Orbit
Science|How many sides does a hexagon have?|Six|Five|Seven|Eight
Science|What force keeps planets in orbit around the Sun?|Gravity|Friction|Magnetism|Pressure
Science|Which blood cells help fight infection?|White blood cells|Red blood cells|Platelets|Plasma
Science|What is the largest organ of the human body?|Skin|Liver|Lungs|Heart
Science|At what temperature does water freeze in Celsius?|0|10|-10|32
Science|Which vitamin is produced when skin is exposed to sunlight?|Vitamin D|Vitamin A|Vitamin C|Vitamin K
Science|What is the chemical symbol for sodium?|Na|So|S|Sd
Geography|Which ocean is the largest?|Pacific Ocean|Atlantic Ocean|Indian Ocean|Arctic Ocean
Geography|What is the capital of Portugal?|Lisbon|Porto|Madrid|Seville
Geography|Which country is shaped like a boot?|Italy|Greece|Croatia|Portugal
Geography|Mount Fuji is located in which country?|Japan|China|South Korea|Thailand
Geography|Which river flows through Paris?|Seine|Thames|Danube|Rhine
Geography|What is the capital of Canada?|Ottawa|Toronto|Vancouver|Montreal
Geography|Which is the smallest continent by land area?|Australia|Europe|Antarctica|South America
Geography|The city of Marrakech is in which country?|Morocco|Tunisia|Egypt|Algeria
Geography|Which US state is known as the Aloha State?|Hawaii|Alaska|Florida|California
Geography|What is the capital of South Korea?|Seoul|Busan|Tokyo|Pyongyang
History|Who was the first person to walk on the Moon?|Neil Armstrong|Buzz Aldrin|Yuri Gagarin|Michael Collins
History|The ancient city of Petra is in which modern country?|Jordan|Lebanon|Syria|Iraq
History|Which ship famously sank in 1912?|Titanic|Lusitania|Bismarck|Endurance
History|Who was the first President of the United States?|George Washington|John Adams|Thomas Jefferson|James Madison
History|In which year did the Berlin Wall fall?|1989|1987|1991|1985
History|Which civilization built Machu Picchu?|Inca|Maya|Aztec|Olmec
History|Who painted the ceiling of the Sistine Chapel?|Michelangelo|Leonardo da Vinci|Raphael|Donatello
History|Which English queen was known as the Virgin Queen?|Elizabeth I|Victoria|Mary I|Anne
History|What was the name of the ship Charles Darwin sailed on?|HMS Beagle|HMS Victory|Endeavour|Mayflower
History|Which empire was ruled from Constantinople?|Byzantine Empire|Mongol Empire|Ottoman Empire|Persian Empire
Arts|Who wrote the play Romeo and Juliet?|William Shakespeare|Charles Dickens|Jane Austen|Oscar Wilde
Arts|Which artist painted The Starry Night?|Vincent van Gogh|Claude Monet|Pablo Picasso|Salvador Dalí
Arts|What is the name of Sherlock Holmes's assistant?|Dr Watson|Inspector Lestrade|Mycroft Holmes|Irene Adler
Arts|Which novel begins with the character Bilbo Baggins?|The Hobbit|The Lord of the Rings|The Silmarillion|Watership Down
Arts|Who composed the Four Seasons?|Antonio Vivaldi|Johann Sebastian Bach|Wolfgang Mozart|Ludwig van Beethoven
Arts|Which instrument has 88 keys on a standard version?|Piano|Violin|Harp|Accordion
Arts|What is the fictional school attended by Harry Potter?|Hogwarts|Beauxbatons|Durmstrang|Ilvermorny
Arts|Who created the detective Hercule Poirot?|Agatha Christie|Arthur Conan Doyle|Dorothy Sayers|Wilkie Collins
Arts|Which painter is associated with melting clocks in The Persistence of Memory?|Salvador Dalí|René Magritte|Edvard Munch|Joan Miró
Arts|What is the first name of the composer Tchaikovsky?|Pyotr|Sergei|Igor|Dmitri
Nature|What is the fastest land animal?|Cheetah|Lion|Pronghorn|Horse
Nature|What is a group of lions called?|Pride|Pack|Flock|Colony
Nature|Which mammal lays eggs?|Platypus|Dolphin|Koala|Sloth
Nature|What is the largest species of shark?|Whale shark|Great white shark|Tiger shark|Hammerhead shark
Nature|Which bird is famous for mimicking human speech?|Parrot|Eagle|Penguin|Ostrich
Nature|What do bees collect from flowers to make honey?|Nectar|Pollen only|Sap|Dew
Nature|Which animal is known for changing its colour to blend in?|Chameleon|Iguana|Gecko|Komodo dragon
Nature|What is the tallest type of grass?|Bamboo|Reed|Wheat|Sugarcane
Nature|Which ocean animal has three hearts?|Octopus|Shark|Dolphin|Sea turtle
Nature|What is the name for a baby frog?|Tadpole|Cygnet|Fawn|Hatchling
Food|Which country is credited with inventing sushi?|Japan|China|Thailand|Vietnam
Food|What is the main ingredient in guacamole?|Avocado|Cucumber|Pea|Courgette
Food|Which spice gives many curries their yellow colour?|Turmeric|Cinnamon|Paprika|Cardamom
Food|What type of pastry is used to make profiteroles?|Choux|Puff|Filo|Shortcrust
Food|Which fruit is dried to make a prune?|Plum|Apricot|Date|Fig
Food|What is tofu primarily made from?|Soybeans|Chickpeas|Rice|Lentils
Food|Which cheese is traditionally used in a Greek salad?|Feta|Brie|Gouda|Cheddar
Food|What is the main ingredient in hummus?|Chickpeas|Lentils|White beans|Peas
Food|Which nut is used to make marzipan?|Almond|Hazelnut|Pistachio|Walnut
Food|What is the Italian word for ice cream?|Gelato|Sorbetto|Panna|Dolce
Sport|How many players are on a football team on the pitch?|Eleven|Nine|Ten|Twelve
Sport|In tennis, what word means a score of zero?|Love|Nil|Blank|Deuce
Sport|Which country hosted the first modern Olympic Games in 1896?|Greece|France|Italy|United Kingdom
Sport|How many rings are on the Olympic symbol?|Five|Four|Six|Seven
Sport|In which sport would you perform a slam dunk?|Basketball|Volleyball|Handball|Netball
Sport|What colour jersey is worn by the Tour de France leader?|Yellow|Green|Red|White
Sport|How many holes are played in a standard round of golf?|Eighteen|Nine|Twelve|Twenty-one
Sport|Which sport uses a shuttlecock?|Badminton|Squash|Table tennis|Lacrosse
Sport|What is the highest possible break in snooker?|147|155|140|180
Sport|In baseball, how many strikes make an out?|Three|Two|Four|Five
Technology|What does CPU stand for?|Central Processing Unit|Computer Power Utility|Core Program Unit|Central Program User
Technology|Which company created the Android operating system?|Google|Apple|Microsoft|Samsung
Technology|What does WWW stand for?|World Wide Web|Wide World Window|Web World Wire|World Web Watch
Technology|Which device measures atmospheric pressure?|Barometer|Thermometer|Anemometer|Hygrometer
Technology|What is the name of the toy cowboy in Toy Story?|Woody|Buzz|Jessie|Rex
Technology|Which board game features the streets Mayfair and Park Lane?|Monopoly|Cluedo|Risk|Scrabble
Music|Which band released the album Abbey Road?|The Beatles|The Rolling Stones|Queen|The Who
Music|How many strings does a standard violin have?|Four|Three|Five|Six
Music|Which singer was known as the King of Pop?|Michael Jackson|Elvis Presley|Prince|David Bowie
Music|What is the lowest common male singing voice?|Bass|Tenor|Baritone|Countertenor
Language|What is the plural of mouse when referring to the animal?|Mice|Mouses|Meese|Mouse
Language|Which language has the most native speakers worldwide?|Mandarin Chinese|English|Spanish|Hindi
Language|What is the opposite of a synonym?|Antonym|Homonym|Acronym|Pseudonym
Language|How many letters are in the Greek alphabet?|Twenty-four|Twenty-two|Twenty-six|Twenty-eight
General|How many colours are traditionally named in a rainbow?|Seven|Five|Six|Eight
General|What is the Roman numeral for 50?|L|C|D|X
General|Which month has an extra day in a leap year?|February|January|March|December
General|How many minutes are in two hours?|120|100|110|140
General|What is the name of the toy cowboy in Toy Story?|Woody|Buzz|Jessie|Rex
General|Which board game features the streets Mayfair and Park Lane?|Monopoly|Cluedo|Risk|Scrabble
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
export const WORDS = ['PLANE', 'BREAD', 'CHAIR', 'LIGHT', 'MUSIC', 'TIGER', 'OCEAN', 'STORM'];
export const PHRASES = [{hint: 'IDIOM', phrase: 'BREAK THE ICE'}, {hint: 'MOVIE', phrase: 'THE LION KING'}, {hint: 'LANDMARK', phrase: 'EIFFEL TOWER'}, {hint: 'PROVERB', phrase: 'ACTIONS SPEAK LOUDER'}, {hint: 'FOOD', phrase: 'CHOCOLATE CAKE'}];
