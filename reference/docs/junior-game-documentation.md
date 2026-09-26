# e-Bug Junior Game Implementation Documentation

> Source: Google Drive file "e-Bug Junior Game Documentation.doc" (id `0Bw62SxAHx-pjdk5YZVU3WlpmV1k`), extracted as text and cleaned into Markdown. Code indentation was lost in extraction and has been re-applied mechanically; screenshots from the original are not included (their captions are kept as *[Figure: ...]* markers).

## Contents

- e-Bug Junior Game Implementation Documentation (p. 1)
- File Locations and Purposes (p. 2)
  - Levels Folder (p. 2)
    - Quiz Files (p. 2)
    - Introduction Dialogue (Cutscene) Files (p. 5)
    - Platform Game Level Files (p. 5)
  - Movies Folder (p. 8)
  - Src Folder (p. 10)
- The Code Base: High Level Overview (p. 11)
- Platform Game (p. 18)
  - Platform Game Class (p. 19)
    - Details (p. 20)
- Kitchen Game (p. 36)
- Quiz Game (p. 41)
  - Displaying Round Introduction Text (p. 45)
  - Asking Questions (p. 47)
- Translations (p. 49)

## File Locations and Purposes

The game “root folder” can be accessed from the subversion repository at:

`Svn://server536/ebug_code/`

The root level files in this folder are not used anywhere in the game. They represent an unfinished attempt to make the game playable on websites like Kongregate.com which require that the main Flash swf file be at the root level of the game. Because the Junior game main file is found under the “movies” folder, it is incompatible at present.

There are a number of folders at this level.

### Levels Folder

The game’s content is loaded dynamically. The introduction chat, quiz content and platform game designs are loaded from XML files contained here.

#### Quiz Files

Each quiz round for each country is provided in an XML file with a name like “bg_fr_gameshow_round1.xml” where the “bg” stands for the country (in this case, Belgium), the “fr” stands for language (in this case French) and the number immediately before the period stands for the quiz show round number.

The content from the English language version of quiz round 1 is below.

```xml
<?xml version="1.0" encoding="utf-8" ?>
<round id="0">
  <name>All About Microbes</name>
  <round_id>0</round_id>
  <next_round>en_en_gameshow_round2.xml</next_round>
  <intro_text>
    <blind>
      <statement>Welcome to the first BLIND QUESTION ROUND!</statement>
      <statement>I'm going to ask you some questions but I'm NOT going to tell you if you get them right!</statement>
      <statement>If you get them right, you'll get a great bonus later though, so try your best.</statement>
      <statment>Let's Go!</statment>
    </blind>
    <normal>
      <statement>Well done, you're a hoverboard natural!</statement>
      <statement>Now let's see what you have learned.</statement>
      <statement>You get 10 points for a correct answer, but if you get it wrong, the other player gets points.</statement>
      <statement>so if you DON'T KNOW the answer, it's best to play it safe and say so!</statement>
      <statement>Ready ?</statement>
      <statement>Let's Go!</statement>
    </normal>
  </intro_text>
  <questions>
    <question id="0">
      <type>0</type>
      <score>10</score>
      <value>1</value>
      <text>If you cannot see a microbe it is not there</text>
      <answers>
        <answer>
          <label>Agree</label>
          <value>-1</value>
        </answer>
        <answer>
          <lable>Don't Know</lable>
          <value>0</value>
        </answer>
        <answer>
          <lable>Disagree</lable>
          <value>1</value>
        </answer>
      </answers>
    </question>
    <question id="1">
      <type>0</type>
      <score>10</score>
      <value>1</value>
      <text>Bacteria and Viruses are the same</text>
      <answers>
        <answer>
          <label>Agree</label>
          <value>-1</value>
        </answer>
        <answer>
          <label>Don't Know</label>
          <value>0</value>
        </answer>
        <answer>
          <label>Disagree</label>
          <value>1</value>
        </answer>
      </answers>
    </question>
    <question id="2">
      <type>0</type>
      <score>10</score>
      <value>1</value>
      <text>Fungi are microbes</text>
      <answers>
        <answer>
          <label>Agree</label>
          <value>1</value>
        </answer>
        <answer>
          <label>Don't Know</label>
          <value>0</value>
        </answer>
        <answer>
          <label>Disagree</label>
          <value>-1</value>
        </answer>
      </answers>
    </question>
    <question id="3">
      <type>0</type>
      <score>10</score>
      <value>1</value>
      <text>Microbes are found on our hands</text>
      <answers>
        <answer>
          <label>Agree</label>
          <value>1</value>
        </answer>
        <answer>
          <label>Don't Know</label>
          <value>0</value>
        </answer>
        <answer>
          <label>Disagree</label>
          <value>-1</value>
        </answer>
      </answers>
    </question>
  </questions>
</round>
```

The `<name>` property is unused but was intended to be flash on screen prior to the round starting.

The `<next_round>` property defines the next xml file to be used in the quiz.

The `<intro_text>` defines the lines of dialogue the user sees from the Gameshow Host prior to actually getting to the questions. There is a `<blind>` set and a `<normal>` set. The `<blind>` set are used in the ‘blind question round’ format where the user does not get given answers to her questions. The current (live) version excludes the blind question round.

The questions are contained within a `<questions>` tag. Each has its own `<question>` tag.

All questions share the same `<type>` and as such, this is redundant. The original plan was to allow for more types of question than “agree” “don’t know” and “disagree” but this was never executed.

The `<score>` property defines the amount of points given to the player from a correct answer. Half of this number is given to the opponent if the player gets the wrong answer.

The `<value>` property defines a weighting to give this question for research purposes – i.e. some questions could be valued as more important. This was never used.

Each `<answer>` has a `<label>` which defines the text presented to the user inside the button that she must click. The `<value>` of the `<answer>` defines whether this answer is the correct one (1), incorrect one (-1) or a neutral one which is neither correct nor incorrect (0).

#### Introduction Dialogue (Cutscene) Files

The introduction to the quiz takes part via a cut scene. The text for this can be found in the conversations folder. The XML from the English language file is below.

```xml
<?xml version="1.0" encoding="utf-8" ?>
<conversation>
  <statement>Hello and welcome to the e-Bug Game Show!</statement>
  <statement>Soon you will be visiting the weird world of the microbe.</statement>
  <statement>But first, who do you want to play as?</statement>
  <statement></statement>
  <statement>Tell me a little about yourself:</statement>
  <statement>Nickname</statement>
  <statement>Age</statement>
  <statement>email address</statement>
  <statement>You don't need to give us this information, but if you do you'll be able to take part in competitions and hear about new versions of the game.</statement>
  <statement>Let's see what you know about microbes.</statement>
</conversation>
```

As can be seen, the `<conversation>` consists of a number of `<statement>`s. The cutscene Flash movie is programmed to this exact number of statements and understands that the “Nickname”, “Age”, “email address” statements are used together on the user-input screen (the one that asks for this information from the user).

#### Platform Game Level Files

Despite the game no longer being in ‘alpha’ state, the platform game levels have filenames like “alpha_level1.xml” where the number specifies the level number.

The format of an example level (the first platform game level) is provided and explained below:

```xml
<?xml version="1.0"?>
<level cols="69" rows="9" next="alpha_level2.xml" name="level1">
  <goals>
    <goal microbeType="11" required="3" goalType="0" />
  </goals>
  <tiles>
    <tile id="0">
      <movie>C_Chip_L_Tile</movie>
      <type>1</type>
      <sides>
        <left>1</left>
        <right>1</right>
        <top>1</top>
        <bottom>0</bottom>
      </sides>
      <rows>1</rows>
      <cols>1</cols>
      <entity>0</entity>
      <script>1</script>
    </tile>
```

(I’ve omitted MANY tiles here – but all follow same format)

```xml
<tile id="112">
  <movie>antibiotic_pickup</movie>
  <type>21</type>
  <sides>
    <left>1</left>
    <right>1</right>
    <top>1</top>
    <bottom>0</bottom>
  </sides>
  <rows>1</rows>
  <cols>1</cols>
  <entity>0</entity>
  <script>1</script>
</tile>
</tiles>
<rows>
  <row id="0">
    <column id="0">
      <tile id="20" />
    </column>
    <column id="59">
      <tile id="21" />
    </column>
  </row>
  <row id="1">
    <column id="6">
      <tile id="111" />
    </column>
    <column id="45">
      <tile id="93" />
    </column>
  </row>
```

(I have omitted 7 rows here – each with MANY columns)

```xml
<rows>
</level>
```

Each `<level>` must have properties defining the size of the level. The physics system puts an invisible box around the level, preventing things from falling out. The size of this is defined by the cols and rows properties which refer to the number of columns in the game and the number of rows respectively. At the intersection of each column and row is a 50x50 pixel square which may or may not hold a tile.

The “next” property refers to the next level to load once the player exits via the blue portal at the end of the level. If this has the value “exit” then the platform game exits and control is returned to the quiz show.

Originally, it was possible to have multiple `<goals>` in each level instead of just one (such as “push three lucy lactobacilli into milk”). The `<goal>` for the level decides when the portal is opened, allowing the player to leave. The `<goal>` has a “goalType” which corresponds to a static variable in the Goal.as code file.

```actionscript
public static var PHOTOGRAPH_SPECIFIC : Number = 0;
public static var PHOTOGRAPH_GOOD : Number = 1;
public static var PHOTOGRAPH_BAD : Number = 2;
public static var PHOTOGRAPH_ANY : Number = 3;
public static var KILL_ALL : Number = 4;
public static var KILL_SPECIFIC : Number = 5;
public static var ANTIBIOTIC : Number = 6;
public static var YOGURT : Number = 7;
```

In level one, the player has to photograph bacteria so the goalType is 3.

Each `<goal>` may also have a microbeType which identifies which type of microbe that the goal refers to. The types are found in static variables in the Constants.as code file.

```actionscript
public static var GAME_ENTITY_LUCY : Number = 11;
public static var GAME_ENTITY_SANDY : Number = 12;
public static var GAME_ENTITY_PATTY : Number = 13;
public static var GAME_ENTITY_STEVE : Number = 14;
public static var GAME_ENTITY_COLIN : Number = 15;
public static var GAME_ENTITY_SLARG : Number = 16;
public static var GAME_ENTITY_SLURM : Number = 17;
public static var GAME_ENTITY_IGGY : Number = 18;
public static var GAME_ENTITY_DONNA : Number = 19;
```

In the first level, the microbeType is 11 since the player is photographing Lucy Lactobacilli.

Each `<goal>` also has a property “required” which specifies how many times the player must perform the goal action in order to satisfy the goal. In the first level, this refers to how many correct photographs must be taken (3).

Since each level is built from a series of tiles, the `<tiles>` are specified at the start of each level. This is sub-optimal since not every tile is used in every level. A future optimisation should only include tiles that are USED in the given level.

Each `<tile>` has a unique “id” number. The `<movie>` specifies flash movie clip from the platform game movie’s library that has the art for this tile. The `<movie>` name must match the linkage name of that clip in the library. For the level editor to work, the linkage id of the movie must also match here.

The `<type>` of a tile refers to its entity type as specified in the Constants.as code file.

```actionscript
public static var GAME_ENTITY_PLAYER:Number = 0;
public static var GAME_ENTITY_TILE:Number = 1;
public static var GAME_ENTITY_ERASER:Number = 2;
public static var GAME_ENTITY_GENERIC:Number = 3;
public static var GAME_ENTITY_GOOD_MICROBE:Number = 4;
public static var GAME_ENTITY_BAD_MICROBE:Number = 5;
public static var GAME_ENTITY_PORTAL_EXIT:Number = 6;
public static var GAME_ENTITY_PORTAL_ENTRANCE:Number = 7;
public static var GAME_ENTITY_BULLET:Number = 8;
public static var GAME_ENTITY_AMMO_PICKUP:Number = 9;
public static var GAME_ENTITY_CAMERA_FLASH:Number = 10;
public static var GAME_ENTITY_LUCY : Number = 11;
public static var GAME_ENTITY_SANDY : Number = 12;
public static var GAME_ENTITY_PATTY : Number = 13;
public static var GAME_ENTITY_STEVE : Number = 14;
public static var GAME_ENTITY_COLIN : Number = 15;
public static var GAME_ENTITY_SLARG : Number = 16;
public static var GAME_ENTITY_SLURM : Number = 17;
public static var GAME_ENTITY_IGGY : Number = 18;
public static var GAME_ENTITY_DONNA : Number = 19;
public static var GAME_ENTITY_MILK : Number = 20;
public static var GAME_ENTITY_ANTIBIOTIC_PICKUP : Number = 21;
public static var GAME_ENTITY_ANTIBIOTIC_BOMB : Number = 22;
public static var GAME_ENTITY_SUPERINFECTION : Number = 23;
```

Normal (non ‘entity’) tiles are type 1.

Original plans allowed for some sides of a tile to permit entry and for other sides to be solid. In the end, all sides were solid so the `<sides>` element has no functionality.

Similarly, the ability for a single tile to be larger than one row and column in size were never fulfilled so the `<rows>` and `<cols>` values must be 1.

If a tile has an `<entity>` value of > 0 then it is not a ‘normal tile’ (see “type” above).

The `<script>` element is no longer functional.

Once all the `<tiles>` have been specified, the actual level can be built from these.

Every level has 9 `<rows>` and each row refers to a vertical row within that level. The `<row>` with “id=0” refers to the uppermost row of tiles.

Within each row, there are naturally many `<column>`s. Instead of listing all of the possible tile spaces in the game, only the columns which have a tile for this row are included.

The `<row id=”0”>` in level 1 has two `<column>`s – one at 0 (which is the top left of that level then) and one at row 59.

Within each `<column>`, within the `<row>` there can be one `<tile>`. The `<tile>`’s id refers to the collection of tiles above. The level loader uses this id number to look up the `<tile>` definition and load the appropriate block (or game entity).

### Movies Folder

This folder contains both the source FLA files and the compiled SWF files used by the game. This folder also contains many old, unfinished or not-used flash files and is a bit of a mess. The subfolders contained here (assets, Microbes_Motions etc) are not used at run time by the game.

Ad2.fla is the flash file used to create the animated advertisement / button that is used to launch the junior game.

Amy.fla is the Amy avatar used in the platform game.

Antibiotic_pickup.fla is the antibiotic pill that the player picks up in the last level of the game.

Avatar_Amy_Fridge.fla (and Avatar_Harry_Fridge.fla) are the characters used in the kitchen game.

Cutscene_introduction.fla is used to provide the initial chat with the Gameshow Host that happens before the player is shrunken and transported to the platform game.

e-Bug Junior Game.fla is the main game file – this movie loads all the other movies in turn to make the game.

EBug Level Editor.fla is used to edit and create levels for the platform game.

eBugGameShow.fla provides the game show component of the game. It is loaded by the main Junior Game movie.

Harry.fla is the platform game version of Harry on the hoverboard.

IntroductionToMicrobes_platformer.fla is the platform game component of the game. It is loaded and controlled by the main Junior Game movie.

Junior_game_assets.fla is used by the pre-loader to load the assets into memory before the game starts. After the game starts, further requests to load the item do not need to access the disk.

Kitchen_game_intro_level_X.fla (where X is 0,1,2 or 3) provides the introduction text and instructions for the appropriate kitchen game level.

Kitchen_game_main is where most of the actual kitchen game happens.

KitchenGame.fla is the kitchen game coordinator in the game. It is loaded and controlled by the Junior Game movie.

Level_intros.fla provides the animated ePhone introductions that pop up at the start of the platform game levels.

OutputXMLFilesMovie.fla is used to provide the translated quiz and dialogue XML files for each country. If you open the file and change the language string to the appropriate language setting and then run the clip, and output window is created with all the XML in it. Copy / paste this XML into the appropriate .XML file to create the localised version. (Use this movie with the Translations.as code file).

Shrinking Zone Amy (and Harry).fla provides the version of the avatar used for shrinking prior to platform game levels.

Splash.fla provides the animated e-Bug splash screen that starts the junior game (the clip with the TV).

Summary_page.fla is used to summarise player performance after each level of the kitchen game. This is the screen that tells the player what they got right and wrong.

Talkie.fla powers the dialogue system – it is given an array of statements and implements the talking box behaviour used to allow the Gameshow Host to talk to the player.

### Src Folder

The src (stands for source) folder contains all the ActionScript files used to create the game. They are explained in more detail below but it is worth nothing that in the top folder of src there are 50 ActionScript files with names like “HarryShirtCollar03ColouredObject.as”. These were created as part of an unfinished feature that would allow players to customise their avatar.

Since ActionScript 2 doesn’t allow an easy way to change “all red pixels to green” or similar, we had to give each and every blob of colour its own Class definition. Each of these .as files simply overrides that object’s colour. This does work but since the colour CHOOSER app was never written, the game does not allow for character customisation.

The Physics folder within src is not used. I ported the physics model of the game from my own code to an open source library when I was seeking performance improvements. I did not receive any and thus removed the open source library from the code. This physics folder is a hangover from that.

## The Code Base: High Level Overview

The first movie to load is the e-Bug Junior Game.fla

The Flash movie has a few clips on the stage. The FPS counter is turned off when the game isn’t in development. When turned on, it shows the number of frames the game is rendering per second. A playable experience is anything above 20 frames per second.

There is a loader clip on the stage which manages the loading of other game assets, updating a percentage as it does so and there is a gameScreen clip.

The gameScreen clip is empty and it is into this clip that the actual game is loaded.

This is facilitated by code on the first frame of the e-Bug Junior Game FLA

```actionscript
var gameController : GameController = new GameController(this, this["gameScreen"], language);
```

The GameController is the class used to coordinate the game. It is responsible for deciding which clips (quiz, platform, kitchen etc) should be visible at any given time. It is also responsible for passing control over to those clips and receiving control when those clips have finished their work.

```actionscript
function GameController(theRoot : MovieClip, theStage : MovieClip, language : String) {
  System.security.allowDomain("http://www.e-bug.eu");
  System.security.allowDomain("http://e-bug.eu");
  System.security.allowDomain('*');
  this.theStage = theStage;
  this.theRoot = theRoot;
  this.language = language;
  this.path = "../";
  gameScreen = this.theStage;
  fadeTime = 5;
  fadingScreenOut = false;
  screensLoaded = 0;
  firstTimeHoverboard = true;
  round = 0;
  gameStructure = new Object();
  gameStructure.hoverboardLevels = new Array();
  gameStructure.gameshowQuestions = new Array();
  //loadListener = new Object();
  //contentLoader = new MovieClipLoader();
  //gameShow = new GameShow();
  submitMovie = theRoot.createEmptyMovieClip("submitMovie", theRoot.getNextHighestDepth());
  assetLoader = new AssetLibrary(theRoot, theStage, path+"movies/", theRoot["loader"], theStage, "Loading");
}
```

The GameController is initialised with a link to the gameScreen which is referred to within most game classes as theStage. The user’s language is also passed at this stage (it is passed to the e-Bug Junior Game.fla from the webpage that embeds the clip via flash vars).

The System.security stuff is to allow the game to submit scores to the database. This is done via the submitMovie.

The assetLoader that is created is later used to load all required assets off disk. As it does so, it updates the loading percentage text.

Most of the actual initialisation is performed in the init() method.

```actionscript
function init() {
  // each level added here is a start level.
  gameStructure.hoverboardLevels.push("alpha_level1.xml");
  gameStructure.hoverboardLevels.push("alpha_level5.xml");
  gameStructure.hoverboardLevels.push("alpha_level8.xml");
  gameStructure.hoverboardLevels.push("NULL_KITCHEN_GAME");
  gameStructure.hoverboardLevels.push("alpha_level10.xml");
```

Because there are multiple hoverboard levels for each round of the game, it is necessary to know the name of the first hoverboard level of the next game round. For the one round that doesn’t have a hoverboard level, NULL_KITCHEN_GAME is used to indicate that the kitchen game will run instead.

```actionscript
// the actual show is the child of the movie clip - hence this pairing
gameshowHolder= theRoot.createEmptyMovieClip("gameshow_holder", theRoot.getNextHighestDepth())
hoverboardHolder= theRoot.createEmptyMovieClip("hoverboardHolder", theRoot.getNextHighestDepth());
splashHolder = theRoot.createEmptyMovieClip("splash", theRoot.getNextHighestDepth());
cutsceneHolder = theRoot.createEmptyMovieClip("cutscene_intro", theRoot.getNextHighestDepth());
summaryPageHolder = theRoot.createEmptyMovieClip("summaryPageHolder", theRoot.getNextHighestDepth());
kitchenGameHolder = theRoot.createEmptyMovieClip("kitchenGameHolder", theRoot.getNextHighestDepth());
// contentLoader.loadClip("eBugGameShow.swf", gameshowHolder);
```

These (the bolded items) are the actual clips which are made visible and invisible to control the game flow. They are created here as empty movie clips. Later, the assetLoader loads the actual clips into memory.

```actionscript
assetLoader.setLoadingText("loading...");
var assetList : Array = new Array();
assetList.push("junior_game_assets.swf");
assetList.push("splash.swf");
assetList.push("eBugGameShow.swf");
assetList.push("introductionToMicrobes_mainMenu.swf");
assetList.push("cutscene_introduction.swf");
assetList.push("introductionToMicrobes_platformer.swf");
assetList.push("harry.swf");
assetList.push("amy.swf");
assetList.push("summary_page.swf");
assetList.push("KitchenGame.swf");
assetLoader.loadAssets(this, "assetsLoaded", assetList);
//trace("hello");
}
```

When all of the assets are loaded, the game is ready to start. The various game screens are made invisible and then the splash screen is made visible to prompt the user to click ‘new game’.

```actionscript
function assetsLoaded() {
  //trace ("all assets loaded");
  splashHolder = assetLoader.assets["splash"];
  cutsceneHolder = assetLoader.assets["cutscene_introduction"];
  gameshowHolder = assetLoader.assets["eBugGameShow"];
  hoverboardHolder = assetLoader.assets["introductionToMicrobes_platformer"];
  assetLoader.loadingScreen._visible = false;
  summaryPageHolder = assetLoader.assets["summary_page"];
  kitchenGameHolder = assetLoader.assets["KitchenGame"];
  gameScreen._visible = true;
  gameScreen._alpha = 100;
  splashHolder._visible = true;
  splashHolder._alpha = 100;
}
```

*[Figure: The splash screen that appears at the start of play]*

When the user clicks on the ‘New Game’ button, this message is relayed through a function on the e-Bug Junior Game root level called newGame

```actionscript
function newGame() {
  gameController.newGame();
}
```

If you look at the ActionScript contained in the root level, you’ll see that most of it is function call hooks that allow code to ask the root to perform some action. The root simply forwards this to the appropriate object.

The Game Controller receives the request for a new game and starts the game playing.

```actionscript
function newGame() {
  player = new Player();
  player.forename = "david";
  //splashHolder._visible = false;
  splashHolder.unloadMovie();
  cutsceneHolder.player = player;
  cutsceneHolder._visible = true;
  cutsceneHolder._alpha = 100;
  //cutsceneHolder.play();
}
```

Many of the Game Controller’s functions behave like this. They make some clips invisible and make others visible.

The cutscene holder plays the introduction speech by the Gameshow Host. Once the cutscene clip has received the user’s choice of avatar and personal details, the Game Controller is asked to start the quiz.

```actionscript
function startQuizShow() {
  //cutsceneHolder._visible = false;
  // have player data so create id form entry
  player.id = timestamp();
  submitMovie.name = player.nickname;
  submitMovie.UID = player.id;
  submitMovie.age = player.age;
  submitMovie.sex = player.sex;
  submitMovie.email = player.email;
  submitMovie.IP = "18.15.16.111";
  submitMovie.hasBeenTaught = "no";
  submitMovie.school_code = "DF";
  submitMovie.timestamp_1 = timestamp();
```

Notice how this works. We want to submit the player’s credentials to the server for database storage. To do this, we give a move clip (in this case submitMovie) a property for each that we want to submit.

```actionscript
submitMovie.loadVariables("http://www.e-bug.eu/ebug_secret.nsf/ID_Form?CreateDocument","POST");
```

Having populated submitMovie, the loadVariables command is used to access the submission form url. Flash will treat the properties of the movie as form submit fields.

```actionscript
cutsceneHolder.unloadMovie();
gameShow.player = player;
gameshowHolder._visible = true;
gameshowHolder._alpha = 100;
gameshowHolder.play();
```

Having submitted the user data, the cutscene is unloaded (since it is only viewed once) and the quiz starts. However since the game has finished evaluation, there is no ‘blind question round’ prior to game start. It is necessary instead to go straight to the shrinking zone and shrink the player then start the hoverboard game.

Because the shrinking zone is accessed following a line of dialogue from the game show host, the actual quiz activation was commented out and the talkie was used to activate shrinking.

```actionscript
//gameShow.play();
//gameShow.init();
//gameShow._visible = false;
/* this code was added to change the behaviour FROM going straight into quiz (blind round) TO going straight to shrink zone */
gameShow.talkie.init(gameShow.hostname, Translations( _root.translations ).getString( Translations.STRING_STEP_RIGHT_THIS_WAY) , "start", "wait_for_click", null, gameShow, "showShrinkingZone");
```

The shrinking zone animation finishes and the game controller looks at the current round id (0) and decides to start the hoverboard game.

```actionscript
function showHoverboardOrKitchen() {
  trace ("Round is: " + round);
  // should be round ==3 but round is being incremented inside hoverboard thing
  if ( round == 2 ) {
    round++;
    showKitchen();
  } else {
    showHoverboard();
  }
}
```

The hoverboard clip is then given control for a while until the player finishes the level.

```actionscript
function showHoverboard() {
  clearInterval(gameShow.interval);
  gameshowHolder._visible = false;
  hoverboardHolder._visible = true;
  hoverboardHolder._alpha = 100;
  //trace("show hb - goign to root nhr");
  nextHoverboardRound() ;
}
```

The hoverboard game will be explained later but for the purposes of this overview, it finishes and returns control to the Game Controller (via the root) through this function.

```actionscript
function endofHoverboard(reason : Number) {
  if ( reason == PlatformGame.END_REASON_DIE ) {
    clearInterval(hoverboardHolder.gameInterval);
    summaryPageHolder.text0.text = Translations(_root.translations).getString( Translations.STRING_YOU_DIED );
    summaryPageHolder.text1.text = Translations(_root.translations).getString( Translations.STRING_QUIZ_CLICK_BUTTON_TO_CONTINUE );
    summaryPageHolder._visible = true;
    summaryPageHolder._alpha = 100;
    summaryPageHolder.callObj = this;
    summaryPageHolder.callFunc = "restartHoverboardRound";
  } else if ( reason == PlatformGame.END_REASON_TIME ) {
    clearInterval(hoverboardHolder.gameInterval);
    summaryPageHolder.text0.text = Translations(_root.translations).getString( Translations.STRING_QUIZ_NO_TIME );
    summaryPageHolder.text1.text = Translations(_root.translations).getString( Translations.STRING_QUIZ_CLICK_BUTTON_TO_CONTINUE );
    summaryPageHolder._visible = true;
    summaryPageHolder._alpha = 100;
    summaryPageHolder.callObj = this;
    summaryPageHolder.callFunc = "restartHoverboardRound";
  }
```

This function looks to see the reason the player has exited the hoverboard game. If it is because time ran out or the player died, the player is returned to try the level again.

If it is because the player exited the level, the quiz is told to start the next round and control is passed to the game show for a while.

```actionscript
else {
  clearInterval(hoverboardHolder.gameInterval);
  gameshowHolder._visible = true;
  gameShow._visible = true;
  hoverboardHolder._visible = false;
  gameShow.nextRound();
  //nomoreblind
  //gameShow.startNonBlindRound();
}
}
```

The quiz will also be explained below but as above, the player is eventually presented with the shrink animation and the hoverboard starts again. Round 3 sees the player taken to the kitchen game instead of the hoverboard game but the exact same principles are used. The kitchen screens are made visible and everything else is made invisible. When the kitchen game is finished, it passes control back to the Game Controller via the root call endOfKitchen.

```actionscript
function endOfKitchen(updatedPlayer : Player) {
  trace ("updated player has " + updatedPlayer.score + " vs " + player.score);
  // clearInterval(hoverboardHolder.gameInterval);
  trace("end of kitchen in controller");
  gameshowHolder._visible = true;
  gameShow._visible = true;
  kitchenGameHolder._visible = false;
  gameShow.startNonBlindRound();
}
```

It is worth noting that prior to sending the player to a hoverboard or kitchen round, after a quiz round has finished, the player’s results are sent to the server for saving in the database using the Game Controller function submitPlayerData.

```actionscript
function submitPlayerData(roundId : Number, blind : Array, sighted : Array) {
  trace ("Submit player data for round: " + roundId);
  trace ("Blind First");
  var tmp : MovieClip = theRoot.createEmptyMovieClip("submitMovie"+getTimer(), theRoot.getNextHighestDepth());
  tmp["timestamp_rnd_"+ Number(Number(roundId)+1)] = timestamp();
  tmp.UID = player.id;
  tmp.name = player.nickname;
  for ( var i = 0; i < blind.length; i++) {
    tmp["pre_question_" + Number(i + 1) + "_rnd_" + Number(Number(roundId) + 1)] = blind[i];
    trace ("pre_question_" + Number(i + 1) + "_rnd_" + Number(Number(roundId) + 1) + " = " + blind[i]);
  }
  trace("now sighted");
  for ( var i = 0; i < sighted.length; i++) {
    tmp["post_question_" + Number(i + 1) + "_rnd_" + Number(Number(roundId) + 1)] = sighted[i];
    trace ("post_question_" + Number(i + 1) + "_rnd_" + Number(Number(roundId) + 1) + " = " + sighted[i]);
  }
  trace ("pre_question_1_rnd_1 should be: " + tmp["pre_question_1_rnd_1"]);
  tmp.loadVariables("http://www.e-bug.eu/ebug_secret.nsf/Round_"+Number(Number(roundId)+1)+"_Form?CreateDocument","POST");
  /*
  for ( var i in answers) {
    trace ("question: " + i +" = " + answers[i]);
  }*/
}
```

This function submits both blind and ‘normal’ quiz rounds simultaneously. In the released version of the game there is no blind round but an empty blind submission is still made.

## Platform Game

The introductionToMicrobes_platformer.fla file is the main file for the platform game.

*[Figure: The platform game Flash file viewed in Flash]*

As can be seen from the screenshot above, the main elements of the user interface for the platform are loaded on the stage. Some of these elements like the ePhone and the level intros box exist as individual FLA files in the movies folder.

When running the game, it is possible to ask the phone to grow (and rotate to the left) so that the level intro is shown.

In the first frame of the movie, the XML file that defines the possible tiles is loaded.

```actionscript
var tdp : TileDefinitionParser = new TileDefinitionParser();
tdp.loadXML("../levels/tile_definitions.xml");
```

An interval starts the tile definitions loading and checks periodically if these have loaded.

```actionscript
gameInterval = setInterval(this, "tilesReady", 40);
```

The game does not progress until these are loaded.

```actionscript
function tilesReady() {
  if ( tdp.loading == false ){
    clearInterval (gameInterval);
    game.initialiseGame(player, level, tdp.tiles);
    trace("go to main");
    this.gotoAndStop("main");
  }
}
```

When the tiles are loaded, the game moves to the ‘main’ frame which contains the following code.

```actionscript
gameInterval = setInterval(loop, 15);
trace ("------------------- platformer at main");
function loop():Void {
  game.main();
}
```

This code causes the loop function to be called every 15 milliseconds. The loop function in turn asks the game to run its main function.

This main function being called every 15 milliseconds is what powers the game.

The ‘game’ object mentioned above is the PlatformGame object.

### Platform Game Class

As the IntroductionToMicrobes_platformer.fla movie is the main movie for the platform game, the PlatformGame.as class is the main class for the game.

At its simplest, the Platform game has two phases. Update World and Render World.

Update World sees the game looping around all game entities and seeing if they need to be moved or have their state changed.

Render World is responsible for drawing graphics as required – but since flash ties objects and their graphics so closely together, many objects are moved during the update world phase.

#### Details

```actionscript
var mapBuilder:MapBuilder;
var level:Level;
var nextLevel:String;
```

The mapBuilder object loads the XML for the level and constructs a level. This level is placed in the level object.

```actionscript
// this is a bit hacky - want to be able to differentiate between body and outside so we can treat soap and white blood
// as same in most code but choose the appropriate one.
var bodyLevel : Boolean;
```

The functional behaviour of soap levels and white-blood-cell levels is identical but for the graphic used as the ‘bullet’. The bodyLevel Boolean is used to differentiate which graphic should be used.

```actionscript
// stores the base tile movies which are cloned for on-screen cells
var tiles:Array;
// stores movies for all currently instanced tiles
var cells:Array;
```

Instead of loading each tile from the library for each square which uses that tile, one copy of the tile is loaded and is cloned for each instance. The originals are stored in tiles. The instances are stored in cells.

```actionscript
// as the screen scrolls, local positions need offset by how far into the level we are
// these variables count in columns, not pixels.
var leftMostColumn:Number;
var rightMostColumn:Number;
// this number is added or subtracted from entity position in order to accurately draw on screen.
// counts in pixels and is used to position movie clips.
var pixelOffset:Number;
```

Because the level is larger than the screen can show, it is necessary to do some relative positioning to determine what to draw and what not to draw. Typically, one or two columns of tiles are loaded on either side of the main window. This way tiles for the whole level don’t need to be moved every frame (slowing the game down).

```actionscript
public static var SCROLL_MARGIN_RIGHT : Number = 450;
public static var SCROLL_MARGIN_LEFT : Number = 250;
```

The game scrolls when the player is < 250 pixels from the left hand side of the screen or > 450 pixels from the left hand side.

```actionscript
// TODO drop jump count - keep max jumps 2 but make reload dependant on contact with ground.
public static var MAX_JUMPS : Number = 2;
public static var JUMP_COUNT : Number = 5;
```

The game permits ‘double jumping’ using the above vars as markers.

```actionscript
// contains all game entities
// each index is an array containing information on the game entity
var entities:Array;
// contains events that affect entity states
var entityEvents : Array;
// indexed by row then col. Contents is index of staticEntities entity for this tile.
var staticEntities : Array;
```

Entities are anything interactive or ‘moving’ in the game. The player is an entity. The microbes are entities. The ‘bullets’ are entities, the portal is an entity etc. The static tiles are held in the staticEntities array. They are separated from the normal entities so that we don’t have to consider them when calculating game logic (tiles don’t think!).

Each new level run of the game starts with the init function.

The important thing to note here is that the default speeds etc are set here, the player lives and timer are reset and that the game is put into the state STATE_INIT.

Because the main function is called so frequently (every 15 milliseconds), the game state is used to control flow.

The main function is basically a huge switch statement. Prior to the game really starting, it moves through the following states.

`STATE_INIT -> STATE_LOAD_LEVEL -> STATE_LEVEL_LOADING -> STATE_LEVEL_LOADED`

At this stage, the XML for the level has loaded and the physics system (the particleSystem object in code) has been given the world dimensions etc..

The game then proceeds to the LOAD_TILES state.

##### State: STATE_LOAD_TILES

```actionscript
// load clips
for (var i:Number = 0; i < this.level.tiles.length; i++) {
  var tempClip:MovieClip = this.attachMovie(this.level.tiles[i].movie, "tile" + i, this.getNextHighestDepth());
  tempClip.stop();
  tempClip.libName = this.level.tiles[i].movie;
  tempClip._x = 0 - tempClip._width;
  tempClip._y = 0 - tempClip._height;
  tempClip._visible = false;
  this.tiles.push(tempClip);
}
```

The required tiles for this level are attached from the library this.attachMovie(this.level.tiles[i].movie, "tile" + i, this.getNextHighestDepth()); and placed into the tiles array: this.tiles.push(tempClip);

Once they are in the tiles array, it is possible to loop around the level definitions and create the physics objects. The physics objects are responsible for detecting player collisions and therefore must be placed to correspond to the graphics position.

```actionscript
// enter tile positions and their bounding boxes into the physics system.
// the static non-entity tiles don't move - so this is set once and not updated every frame.
for (var currentRow:Number = 0; currentRow < level.rows; currentRow++) {
  for (var currentCol:Number = 0; currentCol <= level.cols; currentCol++) {
    if ( !isNaN(level.levelDataGeometry[currentRow][currentCol]) ) {
      var currentClip:MovieClip = this["tile" + level.levelDataGeometry[currentRow][currentCol]];
      //position:Vector3, clip:MovieClip, dynamicEntity:Boolean, force:Vector3, gravityExcempt:Boolean,
      var position:Vector3 = new Vector3( currentCol * Constants.TILE_WIDTH, currentRow * Constants.TILE_WIDTH , 0);
      if (staticEntities[currentRow] == undefined) {
        staticEntities[currentRow] = new Array();
      }
      staticEntities[currentRow][currentCol] = particleSystem.createBoxParticle(position, currentClip, false);
      particleSystem.staticEntities[staticEntities[currentRow][currentCol]].physicsExcempt = true;
    }
  }
}
```

The interesting line here are where the actual physics object is created.

```actionscript
staticEntities[currentRow][currentCol] = particleSystem.createBoxParticle(position, currentClip, false);
```

the box particle (all objects in this game are boxes) are sized based on the movie clip size.

Once all the basic tiles have been loaded and had their physics objects created, the state changes to STATE_CREATE_GUI.

##### State: STATE_CREATE_GUI

The game chooses what to draw on the mini-phone (which is used to track progress during a level). It does this by looking at what type of goal this level has and what microbe is the target of the goal.

```actionscript
if ( level.goals.length > 0) {
  var goal : Goal = Goal(level.goals[0]);
  ePhone.status.nextButton = 1;
  if (goal.goalType == Goal.PHOTOGRAPH_GOOD ) {
    ePhone.status.background.attachMovie("lucy_image", "this", ePhone.status.background.getDepth());
    ePhone.status.mode.attachMovie("camera_icon", "this", ePhone.status.mode.getDepth());
  } else if (goal.goalType == Goal.PHOTOGRAPH_SPECIFIC ) {
    ePhone.status.mode.attachMovie("camera_icon", "this", ePhone.status.mode.getDepth());
    if ( goal.microbeType == Constants.GAME_ENTITY_LUCY ) {
      ePhone.status.background.attachMovie("lucy_image", "this", ePhone.status.background.getDepth());
    } else if ( goal.microbeType == Constants.GAME_ENTITY_STEVE ) {
      ePhone.status.background.attachMovie("steve_image", "this", ePhone.status.background.getDepth());
    } else if ( goal.microbeType == Constants.GAME_ENTITY_SANDY ) {
      ePhone.status.background.attachMovie("sandy_image", "this", ePhone.status.background.getDepth());
    } else if ( goal.microbeType == Constants.GAME_ENTITY_SLARG ) {
      ePhone.status.background.attachMovie("slarg_image", "this", ePhone.status.background.getDepth());
    } else if ( goal.microbeType == Constants.GAME_ENTITY_SLURM ) {
      ePhone.status.background.attachMovie("slurm_image", "this", ePhone.status.background.getDepth());
    }
  } else if ( goal.goalType == Goal.YOGURT) {
    ePhone.status.background.attachMovie("milk_image", "this", ePhone.status.background.getDepth());
  } else if ( goal.goalType == Goal.ANTIBIOTIC) {
    ePhone.status.background.attachMovie("superinfection_image", "this", ePhone.status.background.getDepth());
  } else {
    ePhone.status.background.attachMovie("slurm_image", "this", ePhone.status.background.getDepth());
    ePhone.status.mode.attachMovie("kill_icon", "this", ePhone.status.mode.getDepth());
  }
  for ( var i : Number = 0; i < goal.required; i++) {
    ePhone.status["button"+ (i+1)].gotoAndPlay("empty");
  }
}
```

Game state is then progressed to STATE_CREATE_ENTITIES.

##### State: STATE_CREATE_ENTITIES

Where LOAD_TILES placed all the static entities in the level, CREATE_ENTITIES places all the dynamic ones.

Each entity needs:

- A position (in game columns / rows terms)
- A position for its movie clip (on screen x and y coord)
- A physics particle to identify collisions and track gravity
- A state
- A type

The player is always the first entity created.

```actionscript
var playerPosition:Vector3 = this.level.uniqueItems[Constants.GAME_ENTITY_PLAYER];
playerPosition = playerPosition.multiply(Constants.TILE_WIDTH);
```

The multiplication above converts the position from rows / cols into pixels (3,2 would be 150,100 because each square in the game is 50px.

```actionscript
var playerEntity : PlayerEntity;
playerEntity = new PlayerEntity(this, null, _parent.avatar, MAX_JUMPS);
//change!
playerEntity.lives = 3;
playerEntity.clip._x = playerPosition.x;
playerEntity.clip._y = playerPosition.y;
playerEntity.clip.swapDepths(this.getNextHighestDepth());
playerEntity.particle = particleSystem.dynamicEntities[ particleSystem.createBoxParticle(playerPosition, playerEntity.clip, true, new Vector3(), false, false, new Vector3(49,100,0)) ];
playerEntity.particle.theParent = playerEntity;
```

Unlike with static particles, dynamic particles have variables that govern when they get processor time.

```actionscript
playerEntity.isOnScreen = true;
playerEntity.particle.physicsExcempt = false;
playerEntity.particleIsDynamic = true;
```

The isOnScreen Boolean tracks the position of the entity relative to the screen. Whilst the static tiles are only drawn when they are on screen, dynamic entities are always drawn. To avoid animating them and giving them processor time for no reason, they are only granted access to this when they are on screen.

Some particles are physics exempt (spelled excempt throughout code by mistake!) which means they are not governed by the physics simulation. This is used for various reasons such as when a microbe wants to walk left to right. It is too costly to run a true physics system for many microbes at once so they opt out of the simulation wherever possible and simply ‘decide’ where they should be. Their exemption to physics is turned off when they collide with something or when they fall off a ledge or similar.

```actionscript
playerEntity.particleArrayId = PlatformGame.PLAYER_INDEX;
playerEntity.state = PlayerEntity.PLAYER_STATE_NORMAL;
playerEntity.speed = particleSystem.gravity.y * 1.5 ;
playerEntity.jumpForce = particleSystem.gravity.y * 8;
// place player in proper game entities array
entities.push(playerEntity);
playerEntity.indexId = 0;
mapControls(playerEntity);
playerEntity.type = Constants.GAME_ENTITY_PLAYER;
```

Where the above instantiates one entity (the player), the next game loop instantiates ALL game entities. The code is complex but basically simple. The code loops around the entities contained in the level and creates an entity of the appropriate type based on the value in the levelDataEntities array.

```actionscript
// now loop around level's levelDataEntities array and hook up game entities with behaviour.
for (var currentRow:Number = 0; currentRow < this.level.levelDataEntities.length; currentRow++) {
  for (var currentCol:Number = 0; currentCol < this.level.levelDataEntities[currentRow].length; currentCol++) {
    if ( level.levelDataEntities[currentRow][currentCol] == undefined ) {
    } else {
      // exclude player (catered for above)
      var entityDefinition : Number = this.level.tiles[this.level.levelDataEntities[currentRow][currentCol]];
      if (entityDefinition["type"] != Constants.GAME_ENTITY_PLAYER ) {
        var gameEntityPosition : Vector3 = (new Vector3(currentCol, currentRow)).multiply(Constants.TILE_WIDTH);
        var gameEntityClip : MovieClip = this.attachMovie(entityDefinition["movie"], entityDefinition["movie"]+"_r"+currentRow+"_c"+currentCol, this.getNextHighestDepth(), {_x:gameEntityPosition.x, _y:gameEntityPosition.y, type:entityDefinition["type"]});
        var gameEnt : GameEntity ;
        var gameEntityParticle : EntityBox;
        // good microbes first
        if ( entityDefinition["type"] == Constants.GAME_ENTITY_GOOD_MICROBE || entityDefinition["type"] == Constants.GAME_ENTITY_GENERIC
        || entityDefinition["type"] == Constants.GAME_ENTITY_SANDY
        || entityDefinition["type"] == Constants.GAME_ENTITY_STEVE || entityDefinition["type"] == Constants.GAME_ENTITY_PATTY ) {
          gameEntityParticle = particleSystem.dynamicEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, true)];
          gameEntityParticle.physicsExcempt = true;
          // if ( entityDefinition["movie"] == "lucy_icon" ) {
            // gameEnt = new LucyLactobacillus(this, currentRow, currentCol, gameEntityParticle, gameEntityClip);
            // } else {
            gameEnt = new GoodMicrobe(this, currentRow, currentCol, gameEntityParticle, gameEntityClip);
            // }
          gameEnt.particleArrayId = particleSystem.dynamicEntities.length -1;
          gameEnt.particleIsDynamic = true;
          gameEnt.isOnScreen = true;
          gameEnt.type = entityDefinition["type"];
          gameEnt.particle.theParent = gameEnt;
        } else if (entityDefinition["type"] == Constants.GAME_ENTITY_LUCY ) {
          gameEntityParticle = particleSystem.dynamicEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, true)];
          gameEntityParticle.physicsExcempt = true;
          // if ( entityDefinition["movie"] == "lucy_icon" ) {
            // gameEnt = new LucyLactobacillus(this, currentRow, currentCol, gameEntityParticle, gameEntityClip);
            // } else {
            gameEnt = new LucyLactobacillus(this, currentRow, currentCol, gameEntityParticle, gameEntityClip);
            // }
          gameEnt.particleArrayId = particleSystem.dynamicEntities.length -1;
          gameEnt.particleIsDynamic = true;
          gameEnt.isOnScreen = true;
          gameEnt.type = entityDefinition["type"];
          gameEnt.particle.theParent = gameEnt;
        }// now bad microbres
        else if ( entityDefinition["type"] == Constants.GAME_ENTITY_BAD_MICROBE || entityDefinition["type"] == Constants.GAME_ENTITY_COLIN
        || entityDefinition["type"] == Constants.GAME_ENTITY_DONNA || entityDefinition["type"] == Constants.GAME_ENTITY_IGGY
        || entityDefinition["type"] == Constants.GAME_ENTITY_SLARG || entityDefinition["type"] == Constants.GAME_ENTITY_SLURM ) {
          gameEntityParticle = particleSystem.dynamicEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, true)];
          gameEntityParticle.physicsExcempt = true;
          gameEnt = new BadMicrobe(this, currentRow, currentCol, gameEntityParticle, gameEntityClip);
          gameEnt.particleArrayId = particleSystem.dynamicEntities.length -1;
          gameEnt.particleIsDynamic = true;
          gameEnt.isOnScreen = true;
          gameEnt.type = entityDefinition["type"];
          gameEnt.particle.theParent = gameEnt;
        } // now onto entities such as ammo and portals etc...
        else if ( entityDefinition["type"] == Constants.GAME_ENTITY_AMMO_PICKUP ) {
          gameEntityParticle = particleSystem.staticEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, false, null, true, true)];
          gameEntityParticle.physicsExcempt = true;
          if ( bodyLevel ) {
            gameEnt = new WhitePickup(this, gameEntityParticle, gameEntityClip);
          } else {
            gameEnt = new SoapPickup(this, gameEntityParticle, gameEntityClip);
          }
          gameEnt.particleIsDynamic = false;
          gameEnt.particleArrayId = particleSystem.staticEntities.length - 1;
          gameEnt.isOnScreen = true;
          gameEnt.type = Constants.GAME_ENTITY_AMMO_PICKUP;
          gameEnt.particle.theParent = gameEnt;
          particleSystem.excemptionMatrix[PlatformGame.PLAYER_INDEX][ParticleSystem.STATIC][gameEnt.particleArrayId] = true;
        } else if ( entityDefinition["type"] == Constants.GAME_ENTITY_MILK ) {
          gameEntityParticle = particleSystem.dynamicEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, true, null, true, true)];
          gameEntityParticle.physicsExcempt = false;
          gameEnt = new MilkGlassEntity(this, gameEntityParticle, gameEntityClip);
          gameEnt.particleIsDynamic = true;
          gameEnt.particleArrayId = particleSystem.dynamicEntities.length - 1;
          gameEnt.isOnScreen = true;
          gameEnt.type = Constants.GAME_ENTITY_MILK;
          gameEnt.particle.theParent = gameEnt;
        } else if ( entityDefinition["type"] == Constants.GAME_ENTITY_PORTAL_EXIT ) {
          gameEntityParticle = particleSystem.staticEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, false, null, true, true)];
          gameEntityParticle.physicsExcempt = true;
          gameEnt = new PortalEntity(this, gameEntityParticle, gameEntityClip);
          gameEnt.particleIsDynamic = false;
          gameEnt.particleArrayId = particleSystem.staticEntities.length - 1;
          gameEnt.isOnScreen = true;
          gameEnt.type = Constants.GAME_ENTITY_PORTAL_EXIT;
          gameEnt.particle.theParent = gameEnt;
          portalId = entities.length;
          particleSystem.excemptionMatrix[PlatformGame.PLAYER_INDEX][ParticleSystem.STATIC][gameEnt.particleArrayId] = true;
        } else if ( entityDefinition["type"] == Constants.GAME_ENTITY_ANTIBIOTIC_PICKUP ) {
          gameEntityParticle = particleSystem.staticEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, false, null, true, true)];
          gameEntityParticle.physicsExcempt = true;
          gameEnt = new AntibioticPickup(this, gameEntityParticle, gameEntityClip);
          gameEnt.particleIsDynamic = false;
          gameEnt.particleArrayId = particleSystem.staticEntities.length - 1;
          gameEnt.isOnScreen = true;
          gameEnt.type = Constants.GAME_ENTITY_ANTIBIOTIC_PICKUP;
          gameEnt.particle.theParent = gameEnt;
          particleSystem.excemptionMatrix[PlatformGame.PLAYER_INDEX][ParticleSystem.STATIC][gameEnt.particleArrayId] = true;
        } else if ( entityDefinition["type"] == Constants.GAME_ENTITY_SUPERINFECTION ) {
          gameEntityParticle = particleSystem.dynamicEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, true, null, true, true)];
          gameEntityParticle.physicsExcempt = false;
          gameEnt = new SuperInfection(this, gameEntityParticle, gameEntityClip);
          gameEnt.particleIsDynamic = true;
          gameEnt.particleArrayId = particleSystem.dynamicEntities.length - 1;
          gameEnt.isOnScreen = true;
          gameEnt.type = Constants.GAME_ENTITY_SUPERINFECTION;
          gameEnt.particle.theParent = gameEnt;
        }
        gameEnt.indexId = entities.length;
        entities.push( gameEnt );
      }
    }
  }
}
```

When all entities are loaded, the game moves on to start the level via the level intro dialogue.

##### State: STATE_INIT_DIALOGUE

This simple state just grows the ePhone and then makes the level intro visible. The level intro clip itself just listens for clicks and moves the instructions on. When the last instruction has been clicked, the phone shrinks and then starts the game simulation proper by moving the state to STATE_UPDATE_WORLD.

##### State: STATE_UPDATE_WORLD

This is the most important state in the game. It is responsible for all the ‘magic’ that makes the game move.

The state makes use of an array called entityEvents. Throughout this state, the game checks to see if any interactions require some action. If so, the action is put into the entityEvents array, which acts like a stack.

For example, if the time has run out, then a TRIGGER_GAME_END action (event) is placed in the array.

```actionscript
if ( getTimer() - secondsTimer >= 1000) {
  secondsTimer = getTimer();
  secondsLeft--;
  timeLeft.htmlText = "<b>"+secondsLeft+"</b>";
  if ( secondsLeft < 0 ) {
    secondsLeft = 0;
    entityEvents.push(new Event(Event.TRIGGER_GAME_END, null, null));
    exitReason = END_REASON_TIME;
  }
}
```

The state is responsible for looping around the goals for this level and checking if they have been met. If the goals HAVE been met and the portal is closed then an event is raised to open the portal.

```actionscript
if ( allGoalsAchieved == false) {
  ;
} else if ( entities[portalId].state == PortalEntity.PORTAL_STATUS_CLOSED ) {
  level.goals.pop();
  ePhone.status.background.attachMovie("exit_status", "this", ePhone.status.background.getDepth());
  entityEvents.push(new Event(PortalEntity.PORTAL_EVENT_OPEN, entities[portalId], null));
}
```

If the player has penetrated the scrolling bounds then the game scrolls.

```actionscript
// this is where we move stuff and check actions
if (scrollLeft) {
  this.moveScreenLeft();
  this.dirtyScreen = true;
}
if (scrollRight) {
  this.moveScreenRight();
  this.dirtyScreen = true;
}
```

The purpose of this state is to move everything around and see what needs to happen. To accomplish this, it looks at every entity in turn. The entities who have opted out of being modelled by physics are addressed first.

```actionscript
var numBullets : Number = 0;
// update non-physics entities first, because physics entities are cleverer about resolving conflicts
for (var i:Number = 0; i < entities.length; i++) {
  if ( entities[i].isOnScreen == true ) {
    if ( GameEntity(entities[i]).type == Constants.GAME_ENTITY_BULLET ) {
      numBullets ++;
    }
    var newEvents : Array = GameEntity(entities[i]).advance();
    if ( newEvents != null ) {
      entityEvents = entityEvents.concat(newEvents);
    }
  }
}
```

The GameEntity clas has a method called advance which is called by this loop. Basically every entity has a thinking period and and advancement period. When advancing, it simply carries out a plan unsupervised by the physics system or the game at large. This way, it is possible to have a large number of entities performing without eating too many processor cycles. If every entity had to check whether it was safe to move every frame of the game, the game would run too slow. As such, a microbe will use the ‘think’ phase to decide whether it is safe to move for 10 loops. If so, it will use the advance() call to do this.

You’ll see that the advance() call returns an array of newEvents. These are then looped around to address any issues caused during the advance cycle.

```actionscript
while ( entityEvents.length > 0 ) {
  var currentEvent : Event = Event(entityEvents.shift());
  var newEvents : Array = new Array();
  switch ( currentEvent.type ) {
```

Each event, when processed, may create new events. This loop simply looks at each event in turn and performs a switch on that event. Depending on the type of event, any number of things may happen.

For example, if two entities collided, the COLLIDE event would be processed thus:

```actionscript
case Event.COLLIDE :
  if ( currentEvent.target.type == Constants.GAME_ENTITY_AMMO_PICKUP && currentEvent.params[0].type == Constants.GAME_ENTITY_PLAYER) {
    newEvents = currentEvent.target.act(currentEvent);
    var params : Array = new Array();
    params.push(7);
    var pointsEvent : Event = new Event(Event.MODIFY_POINTS, null, params);
    entityEvents.push(pointsEvent);
  } else if ( currentEvent.target.type == Constants.GAME_ENTITY_BAD_MICROBE && currentEvent.params[0].type == Constants.GAME_ENTITY_BULLET) {
    var params : Array = new Array();
    params.push(3);
    var pointsEvent : Event = new Event(Event.MODIFY_POINTS, null, params);
    entityEvents.push(pointsEvent);
    newEvents = currentEvent.target.act(currentEvent);
  } else {
    newEvents = currentEvent.target.act(currentEvent);
  }
  break;
```

There are two special cases here, and then a generic case.

First special case: if the entity that the current entity hit was some ammo (the rotating soap pickups) AND if the current entity is the player, then two things happen. First, a new event is created to let the ammo know it has been collided with:

```actionscript
newEvents = currentEvent.target.act(currentEvent);
```

(the ammo will remove itself when this is processed).

Secondly, another new event is created to modify player points.

```actionscript
var pointsEvent : Event = new Event(Event.MODIFY_POINTS, null, params);
```

Second special case: If the current entity is a bad microbe and it has been hit by a bullet, then again, the player gets some points and another event is created to let the microbe remove itself.

The generic case is that a new event is created that lets the OTHER entity (not current one being processed) react to the collision. This is because only the first entity to be processed notices the collision. Therefore it is necessary to tell the other entity about the bump.

```actionscript
else {
  newEvents = currentEvent.target.act(currentEvent);
}
```

Each type of event has its own rules and these implement the game rules. Where processing an event has further complications, a new event (or events) are added to the array of events waiting to be processed.

Each entity can be told to act on an event. Therefore although the processing of events happens at this level, inside the PlatformGame, some of the actual implementation of rules happens inside the Game Entities themselves.

For example, the act function of the BadMicrobe class looks like this:

```actionscript
public function act(e : Event) : Array {
  //
  var events : Array = new Array();
  if (isOnScreen) {
    thinkTime --;
    var debugText = "";;
    /*
    * most of the time, the event is just THINK
    * if it is something else, it means we have just started this event
    */
    switch ( e.type ) {
      case Event.THINK :
        thinkTime++;
        events = advance();
        break;
      case Event.WALK :
        state = GameEntity.GAME_ENTITY_STATE_WALK;
        direction = e.params[0];
        clip.gotoAndPlay("walk");
        thinkTime = 0;
        events = advance();
        break;
      case Event.IDLE :
        state = GameEntity.GAME_ENTITY_STATE_IDLE;
        clip.gotoAndPlay("idle");
        thinkTime = e.params[0];
        events = advance();
        break;
      case Event.FALL :
        state = GameEntity.GAME_ENTITY_STATE_FALL;
        counterCeiling = 3;
        counter = counterCeiling;
        clip.gotoAndPlay("fall");
        events = advance();
        break;
      case Event.COLLIDE :
        if (state != GameEntity.GAME_ENTITY_STATE_FALL && state != GameEntity.GAME_ENTITY_STATE_SLIDE
        && state != GameEntity.GAME_ENTITY_STATE_BE_PHOTOGRAPHED && state != GameEntity.GAME_ENTITY_STATE_BE_HIT
        && state != GameEntity.GAME_ENTITY_STATE_BE_KILLED && state != GameEntity.GAME_ENTITY_STATE_BE_WASHED_AWAY) {
          trace ("I am being collided with and my state is: " + state);
          if (e.params[0] instanceof GoodMicrobe || e.params[0] instanceof PlayerEntity || e.params[0] instanceof BulletEntity ) {
            if ( e.params[0] instanceof BulletEntity ) {
              washAway = true;
            } else washAway = false;
            var params : Array = new Array();
            params.push (1);
            events.push( new Event(Event.BE_HURT, this, params));
            state = GameEntity.GAME_ENTITY_STATE_SLIDE;
            slideTimer = slideTimerDefault;
            particle.physicsExcempt = false;
            counterCeiling = 10;
            counter = counterCeiling;
          } else {
            state = GameEntity.GAME_ENTITY_STATE_SLIDE;
            clip.gotoAndPlay("slide");
            slideTimer = slideTimerDefault;
            particle.physicsExcempt = false;
            counterCeiling = 10;
            counter = counterCeiling;
          }
          events = events.concat(advance());
        }
        break;
      case Event.BE_HURT :
        lives -= e.params[0];
        trace("bad microbe be hurt (microbe) " + lives);
        clip.gotoAndPlay("be_hit");
        state = GameEntity.GAME_ENTITY_STATE_BE_HIT;
        if ( lives <= 0 && state != GameEntity.GAME_ENTITY_STATE_BE_KILLED) {
          if (!washAway) {
            events.push( new Event(Event.BE_KILLED, this, params));
            clip.gotoAndPlay("be_killed");
          } else {
            events.push( new Event(EVENT_BAD_MICROBE_WASH_AWAY, this, params));
            clip.gotoAndPlay("be_washed_away");
          }
        }
        break;
      case Event.BE_KILLED :
        state = GameEntity.GAME_ENTITY_STATE_BE_KILLED;
        break;
      case EVENT_BAD_MICROBE_WASH_AWAY :
        particle.physicsExcempt = true;
        particle.gravityExcempt = true;
        state = GameEntity.GAME_ENTITY_STATE_BE_WASHED_AWAY;
        break;
      case Event.BE_PHOTOGRAPHED :
        if ( !hasBeenPhotographed ) {
          hasBeenPhotographed = true;
          state = GameEntity.GAME_ENTITY_STATE_BE_PHOTOGRAPHED;
          clip.gotoAndPlay("be_photographed");
          thinkTime = defaultThinkTime;
          particle.physicsExcempt = true;
          events = advance();
        }
        break;
    }
  }
  return events;
}
```

You can see that each individual type of event has its own behaviour. Individually these behaviours are simple but when each entity has its own reactions to each type of event, the emergent complexity gets quite high.

When the UPDATE_WORLD code has processed all events, the particleSystem is given a call to perform a timeStep.

The ParticleSystem implements the game physics and is explained thoroughly by this paper: <http://www.teknikus.dk/tj/gdc2001.htm>

If entities collided when the particle system ticked over, events were created and stored in the events array so that the next time the UPDATE WORLD state is processed, these will be addressed.

##### State: STATE_RENDER_WORLD

Although dynamic entities pretty much move themselves, the tiles drawing and removing is managed here.

There is a loop that looks at the current screen position relative to the world as whole.

```actionscript
for (var currentCol:Number = leftMostColumn-1; currentCol <= rightMostColumn+1 ; currentCol++) {
  if ( !isNaN(level.levelDataGeometry[currentRow][currentCol])) {
    var currentCell:MovieClip ;
```

As can be seen above, if the cell in the levelDataGeometry array DOES contain a number, then a tile exists here.

If the cell already exists then nothing happens. If there is no existing cell then a new cell is cloned from the tile type, a physics element is created for it and the clip is placed appropriately.

```actionscript
// using the identifying number in the level geometry array, clone the base tile
currentCell = tiles[level.levelDataGeometry[currentRow][currentCol]].duplicateMovieClip("cell"+currentRow+"-"+currentCol, getNextHighestDepth());
currentCell.row = currentRow;
currentCell.col = currentCol;
currentCell.name = tiles[level.levelDataGeometry[currentRow][currentCol]]._name;
cells[currentRow][currentCol] = currentCell;
particleSystem.staticEntities[staticEntities[currentRow][currentCol]].physicsExcempt = false;
```

If the cell being processed is outside the screen then it is removed.

```actionscript
if (currentCell._x > Constants.SCREEN_WIDTH || (currentCell._x + currentCell._width <= 0)) {
  particleSystem.staticEntities[staticEntities[currentRow][currentCol]].physicsExcempt = true;
  currentCell.removeMovieClip();
}
```

##### State: STATE_LEVEL_COMPLETE and STATE_GAME_OVER

These states share code at present. If there is another level, then there is a clean up where cells are removed from screen and memory and then init is called with the next level information.

```actionscript
this.initialiseGame(player,level.next, mapBuilder.tilesList);
```

If there is no next level, or if the game is over then control is passed back to the Game Controller.

```actionscript
if ( gameState == Constants.STATE_GAME_OVER) {
  busy = false;
  busyString = "";
  //trace ("Game state is 'game over' so calling root function endofHoverboard()");
  _root.endofHoverboard(exitReason);
```

#### Other important information in the PlatformGame Class

The mapControls function listens for players pressing keys. The playerEntity is given the opportunity to advance like every other entity. It chooses what to do (jump, move etc) based on its state and the key presses identified here.

The translateNumbersToWords function is needed because the score is presented to the player using the score movieclip. This doesn’t use text to display the score but instead moves an animation to the appropriate frame. As such we need to know what frames to call and cannot rely on numbers. This function translates the numbers to the appropriate frame.

## Kitchen Game

The kitchen food sorting game is coordinated by the KitchenGame.as ActionScript file and the KitchenGame.fla Flash file. Most of the kitchen game action happens in the kitchen_game_main.fla file however.

*[Figure: Screenshot of the kitchen_game_main.fla file as viewed in Flash]*

The kitchen game sees the player clicking on invisible buttons (seen above) that indicate where a food item should be placed.

The KitchenGame.as code is structured in a similar fashion to the PlatformGame.as file with a main function being called periodically by the root. The main function uses game states to manage what happens at any given time.

Normally there are two base states.

```actionscript
switch ( gameState ) {
  case STATE_PICK_ITEM :
    pickItem();
    break;
  case STATE_WAIT :
    // wait for user input
    break;
}
```

If there is no active food item, another is picked. Aside from that, the game is in the wait state.

However, there is significant functionality in the wait state.

If the game timer hasn’t run out then the game uses randomness to determine whether the avatar should start to sneeze.

```actionscript
if ( gameState == STATE_WAIT ) {
  var sneeze : Number = GeneralFunctions.getRandom(0, 10);
  //trace (sneeze + " and " + sneezeChance);
  if ( sneeze > sneezeChance ) {
    startSneeze();
    sneezeChance++;
  }
```

If the user has clicked to wash her hands this animation is played.

```actionscript
} else if ( gameState == STATE_WASH_HANDS ) {
  if ( avatar.midAnimation == false ) {
    handStates[FoodItem.FOOD_STATE_SNEEZE_MICROBES] = false;
    handStates[FoodItem.FOOD_STATE_MEAT_MICROBES] = false;
    gameState = STATE_WAIT;
  }
}
```

This is all fairly simple. The main functionality lives in the receiveInput function which is passed a button name from the main movie (those invisible buttons mentioned earlier).

```actionscript
function receiveInput( buttonName : String ) {
  if ( gameState == STATE_SNEEZE_START ) {
    if ( buttonName == "tissues" ) {
      sneezeHankie();
    } else {
      makeSneeze();
    }
  } else if ( gameState == STATE_WAIT ) {
    /*
    * if restpoint, then it's a throw action, would set state to throw but since throwing is broken, going straight to store
    */
    if ( buttonName.substr(0, 9) == "restpoint" ) {
      var locationType : Number;
```

Each of the destinations has ‘restpoint’ in the name.

The game examines the destination chosen for the current food item and triggers an animation.

The first is for the avatar. The avatar make a hand motion to throw the food item in the rough direction of the destination point.

```actionscript
if ( buttonName == "restpointCupboardBottomRight" || buttonName == "restpointCupboardTopLeft" || buttonName == "restpointCupboardTopRight" || buttonName == "restpointCupboardMidLeft" || buttonName == "restpointCupboardMidRight" || buttonName == "restpointCupboardBottomLeft" || buttonName == "") {
  // throw cupboard
  avatar.gotoAndPlay("cupboard");
  locationType = LOCATION_TYPE_CUPBOARD;
}
```

Then the food is made to disappear from the desk and appear at the destination point.

```actionscript
// remove food from invisible box
foodContainer.content.removeMovieClip();
foodContainer.clingfilm.removeMovieClip();
// now load the food into the resting area
box.content.removeMovieClip();
box.clingfilm.removeMovieClip();
box.attachMovie(currentFoodItem.assetName, "content", box.getNextHighestDepth(), { _xscale: (scale * 100), _yscale:(scale * 100), _y:floorOffset } );
if ( currentFoodItem.foodState[ FoodItem.FOOD_STATE_CLINGFILMED ] ) {
  box.attachMovie("clingfilm_" + currentFoodItem.assetName, "clingfilm", box.getNextHighestDepth(), { _xscale: (scale * 100), _yscale:(scale * 100), _y:floorOffset } );
}
```

Because the food items differ in size, they must be scaled to look correct.

```actionscript
var content : MovieClip = box["content"];
if ( box._width > box._height ) {
  // defined by width.
  var ratio = box._width / box._height;
  if ( content._width > content._height ) {
    content._width = box._width;
  }
}
content._visible = true;
box["content"]._visible = true;
```

At the end of the level, the player’s correct or incorrectness is calculated in the calculateScores function.

This function loops around each location and looks at the food stored there.

```actionscript
for ( var locationId : Number = 0; locationId < levelFoodChoices.length; locationId++ ) {
  var locationFood : Array = levelFoodChoices[ locationId ];
  for ( var foodId : Number = 0; foodId < locationFood.length; foodId++ ) {
    var storedFood : FoodItem = FoodItem( locationFood[ foodId ] );
    if ( levelScores[ storedFood.foodType ] == undefined ) {
      levelScores[ storedFood.foodType ] = new Array();
      levelScores[ storedFood.foodType ]["correct"] = 0;
      levelScores[ storedFood.foodType ]["incorrect"] = 0;
    }
```

If the food has microbes on it from sneezing this is acknowledged here.

```actionscript
if ( storedFood.foodState[ FoodItem.FOOD_STATE_SNEEZE_MICROBES ] ) {
  if ( !sneeze ) {
    sneeze = true;
    levelAdmonishments.push( outroStrings["Sneeze"]);
  }
}
```

Note this line:

```actionscript
levelAdmonishments.push( outroStrings["Sneeze"]);
```

This is the process in which the user is given feedback on her performance.

For each location, the food type is examined and if appropriate admonishments are given or scores are given.

```actionscript
case LOCATION_TYPE_CUPBOARD :
  if ( storedFood.foodType == FoodItem.TYPE_CUPBOARD ) {
    // if mouldy, bad choice
    if ( storedFood.foodState[ FoodItem.FOOD_STATE_MOULDY ] == true ) {
      levelScores[ storedFood.foodType ]["incorrect"] ++;
      if ( !badFood ) {
        levelAdmonishments.push( outroStrings["Bad Food"] );
        badFood = true;
      }
    } else {
      // must be fine tins / bread
      levelScores[ storedFood.foodType ]["correct"] ++;
    }
  } else {
    // whatever it is, it doesn't go here
    levelScores[ storedFood.foodType ]["incorrect"] ++;
    addFoodLocationAdmonishments( storedFood );
  }
  break;
```

The level end notices and level start notices are then displayed.

## Quiz Game

The quiz game is controlled via the eBugGameShow.fla movie. This movie has an object on the stage called game_show. This game_show is of type ebug.junior.GameShow.

As such, the GameShow.as file is responsible for running the actual game show.

It loads the question board, the game show set, the shrinking zone , the talkie, the avatars and the gameshow host from the Library and sets them all to be invisible.

Most of the clips for the Kitchen game are attached from Library, not disk.

```actionscript
// get movies on stage
board = attachMovie("question_board", "board", getNextHighestDepth());
board._visible = false;
studio = attachMovie("gameshow_set", "studio", getNextHighestDepth());
//studio._visible = false;
shrinkingZone = ShrinkingZone(attachMovie("shrinking_zone", "sz", getNextHighestDepth()));
shrinkingZone._visible = false;
talkie = Talkie(attachMovie("talkie", "talkie", getNextHighestDepth()));
talkie._y = 308;
talkie._x = 20;
talkie._visible = false;
```

Like the other two component games, the quiz game is run via a main game loop which is run every 40 milliseconds and which is in charge of managing state.

```actionscript
function init() {
  interval = setInterval(this, "main", 40);
}
```

The main function simply hands off functionality to appropriate functions.

```actionscript
function main() {
  //trace ("main - state: " + gameState + " busy: " + busy);
  if ( !busy ) {
    switch (gameState) {
      case Constants.STATE_INIT:
        isZoneLoaded();
        break;
      case Constants.STATE_LOAD_LEVEL:
        busy = true;
        loadLevel();
        break;
      case Constants.STATE_LEVEL_LOADING:
        levelLoading();
        break;
      case Constants.STATE_LEVEL_LOADED:
        currentRound = questionLoader.round;
        gameState = Constants.STATE_ROUND_TEXT
        break;
      case Constants.STATE_ROUND_TEXT:
        showRoundText();
        break;
      case Constants.STATE_ASK_QUESTION:
        askQuestion();
        break;
      case Constants.STATE_ROUND_OVER:
        ;//wait for control;
        break;
    }
  }
}
```

Because the shrinking zone avatars and the actual quiz round questions are loaded from disk, the quiz has to load them before it can proceed.

An object called the GameShowQuestionLoader is used to load the questions for a particular round.

```actionscript
questionLoader = new GameShowQuestionLoader();
questionLoader.loadRound(questionFile);
```

The GameShowQuestionLoader class is similar to other loading classes in the game in that it receives a URL, initiates loading and then checks until the file has loaded.

The GameShowQuestionLoader then calls a function that is used to convert the XML into game objects.

```actionscript
if (percentage == 100) {
  clearInterval(interval);
  parseRound();
}
```

The Parse Round function is hard coded to suit the quiz round XML format. It extracts the general round information like round id and next round file URL and then reads intro text nodes until it has read all of the blind and normal round text introductions.

```actionscript
/*
* 0 == name
* 1 == round id
* 2 == next round xml filename
* 2 == intro_text
* 3 == questions
*/
round = new GameShowRound();
var rootNote : XMLNode = xml.firstChild;
round.name = rootNote.childNodes[0].firstChild.nodeValue;
// round id
round.roundId = rootNote.childNodes[1].firstChild.nodeValue;
// next round
round.nextRoundFile = rootNote.childNodes[2].firstChild.nodeValue;
// intro text
var textNode : XMLNode = rootNote.childNodes[3];
round.introText = new Array();
round.introText[GameShowRound.BLIND] = new Array();
round.introText[GameShowRound.NOT_BLIND] = new Array();
var blindText : XMLNode = textNode.childNodes[GameShowRound.BLIND];
var notBlindText : XMLNode = textNode.childNodes[GameShowRound.NOT_BLIND];
for (var i : Number = 0; i < blindText.childNodes.length; i++) {
  round.introText[GameShowRound.BLIND][i] = blindText.childNodes[i].firstChild.nodeValue;
}
for (var i : Number = 0; i < notBlindText.childNodes.length; i++) {
  round.introText[GameShowRound.NOT_BLIND][i] = notBlindText.childNodes[i].firstChild.nodeValue;
}
```

Note that the above code is using a game object with type GameShowRound this entire class consists simply of some data objects – the only function is the initialiser. The purpose of GameShowRound is just to hold the round data in the following objects:

```actionscript
public var roundId : Number;
public var introText : Array;
public var name : String;
public var questions : Array;
public var isBlind : Boolean;
public var questionIndex : Number;
public var nextRoundFile : String;
public static var BLIND : Number = 0;
public static var NOT_BLIND : Number = 1;
```

Note that the Blind or Non-Blind status is conferred via a Boolean. For the purposes of the final release, the game is always NOT_BLIND.

Once the intro text has been loaded, the questions are loaded. The code loops around the questions node until all individual questions have been extracted and their data stored in the appropriate GameShowRound data objects.

```actionscript
// questions
var questionNode : XMLNode = rootNote.childNodes[4];
round.questions = new Array();
for ( var i : Number = 0; i < questionNode.childNodes.length; i++) {
  var currentQNode : XMLNode = questionNode.childNodes[i];
  var question : Question = new Question();
  question.questionId = Number(currentQNode.attributes.id);
  question.questionType = Number(currentQNode.childNodes[0].firstChild.nodeValue);
  question.score = Number(currentQNode.childNodes[1].firstChild.nodeValue);
  question.value = Number(currentQNode.childNodes[2].firstChild.nodeValue);
  question.questionText = currentQNode.childNodes[3].firstChild.nodeValue;
  var answers: Array = new Array();
  var answerNode : XMLNode = currentQNode.childNodes[4];
  for (var j : Number = 0; j < answerNode.childNodes.length; j++) {
    var currentAnswer : Answer = new Answer();
    var currentAnswerNode : XMLNode = answerNode.childNodes[j];
    currentAnswer.label = currentAnswerNode.childNodes[0].firstChild.nodeValue;
    currentAnswer.value = Number(currentAnswerNode.childNodes[1].firstChild.nodeValue);
    answers.push(currentAnswer);
  }
  question.answers = answers;
  round.questions.push(question);
}
```

Once this has completed, the loading Boolean is set to false.

```actionscript
loading = false;
```

This allows the GameShow main function to detect the state and move on.

```actionscript
public function levelLoading() {
  if ( questionLoader.loading == false ) {
    currentRound = questionLoader.round;
    gameState = Constants.STATE_LEVEL_LOADED;
  }
}
```

There are basically three stages to the game show. Initially the introduction text is played.

```actionscript
case Constants.STATE_ROUND_TEXT:
  showRoundText();
  break;
```

Then the game asks questions until the player has exhausted all questions in this round.

```actionscript
case Constants.STATE_ASK_QUESTION:
  askQuestion();
  break;
```

At the end of the questions, the control is passed to other parts of the game. Therefore there is no functionality for the STATE_ROUND_OVER state, it is only included for completeness.

```actionscript
case Constants.STATE_ROUND_OVER:
  ;//wait for control;
  break;
```

### Displaying Round Introduction Text

A statement counter tracks how many statements have been displayed. The showRoundText function is invoked and tests to see if we have displayed all the statements. If we have not, then the talkie is instructed to display the text to the user and receive the user’s input.

```actionscript
if (statementCounter < currentRound.introText[GameShowRound.NOT_BLIND].length) {
  talkie.init(hostname, currentRound.introText[GameShowRound.NOT_BLIND][statementCounter], "start", "wait_for_click", null, this, "nextRoundText");
  talkie._visible = true;
}
```

The init function for the talkie uses these parameters so:

Hostname is a String that provides the name that appears at the top of the talkie

currentRound.introText[GameShowRound.NOT_BLIND][statementCounter] is just a call into an array to provide the current statement of text.

“start” is the name of the Flash movie label that starts the animation where each letter appears one at a time.

“wait_for_click” specifies what should happen if the user interrupts the animation mid way by clicking the mouse. In this game, the user can click the mouse to fast forward to the end of the sentence. In practical terms, what happens is that the Talkie fast forwards to the label “wait_for_click”. In cases where the user does not trigger this manually, the animation naturally leads into this label anyway.

The talkie is versatile in that you can sort of program it at runtime to redirect the game when the user clicks at the end of a sentence. Normally this is where you either show another sentence or take control to the big board where the user states their answer. Flash allows dynamic typing and this is used here to dynamically set the function to be called. There are three parameters that can be used here. The first is the name of a static function that should be called. Because we don’t want to call a static function here (we want to call a method belonging to an object) here, this function is set to null.

The this is used to specify the object that combined with the nextRoundText (which is a string specifying the name of a method in GameShow) is used to tell the talkie what to do when the user clicks inside the wait_for_click animation.

This sounds really complicated but basically, we can re-wire the talkie at runtime. In order to rewire it we pass along an object name and a method name and when the user clicks, the talkie calls:

```actionscript
// the _parent is necessary because user input is on the BUTTON which is a child of the talkie.
_parent.callbackObject[_parent.callbackMethod]();
```

Which in practice here, just calls the nextRoundText method inside the GameShow.

*[Figure: The talkie displays the speaker’s name and the text provided. An invisible button is above the entire talkie.]*

Above is described what happens when there ARE statements left – i.e. when the statement counter is not greater than or equal to the statement array length. When the statement counter is higher, this means that there are no statements left. In all cases, this means it is time to ask the questions as shown below.

```actionscript
if (statementCounter < currentRound.introText[GameShowRound.NOT_BLIND].length) {
  talkie.init(hostname, currentRound.introText[GameShowRound.NOT_BLIND][statementCounter], "start", "wait_for_click", null, this, "nextRoundText");
  talkie._visible = true;
} else {
  gameState = Constants.STATE_ASK_QUESTION;
}
}
```

This changes the state so that the quiz runs the askQuestion function next.

### Asking Questions

When asking questions, each question starts with the talkie, as above, and the gameshow host stating the question.

```actionscript
currentQuestion = currentRound.questions[currentRound.questionIndex]
talkie.init(hostname, Translations( _root.translations ).getString( Translations.STRING_QUESTION_NUMBER) + " " + (currentQuestion.questionId+1) + ": " + currentQuestion.questionText + "...", "start", "wait_for_click", null, this, "showBoard");
gameState = Constants.STATE_ASK_QUESTION;
```

After the user clicks this time however, you can see that the method called is “showBoard”. This takes the player to the big board where they choose their answer.

The question board buttons are programmed to pass the user’s input to the receiveAnswer method, passing in the user’s answer.

This method then looks at the answer and performs a number of actions.

One action is to compose the response that the game show host will say.

This is done in two parts.

First, half of the sentence is built referring to the user’s choice.

```actionscript
var response : String = Translations( _root.translations ).getString( Translations.STRING_YOU_CHOSE) + " " ;
if ( value == 0 ) {
  response += Translations( _root.translations ).getString( Translations.STRING_AGREE);
} else if (value == 1) {
  response += Translations( _root.translations ).getString( Translations.STRING_DONT_KNOW);
} else {
  response += Translations( _root.translations ).getString( Translations.STRING_DISAGREE);
}
```

Later, the answer is compared to the correct answer for this question and the response is updated to reflect the user’s correctness.

```actionscript
response += Translations( _root.translations ).getString( Translations.STRING_WRONG_ANSWER);
```

Another action of this method is to trigger the animations for the host and for the player to reflect their performance.

```actionscript
if ( currentQuestion.answers[value].value == Question.ANSWER_WRONG) {
  studio.gsh.gotoAndPlay("disappointed");
  playerAvatar.upper.gotoAndPlay("disappointed");
```

The score is also updated.

```actionscript
changeScore(false, (Math.floor( currentQuestion.score / 2 )));
```

The user’s response is also stored for submission to the server (for research purposes).

```actionscript
roundAnswersSighted[currentQuestion.questionId] = Question.ANSWER_CORRECT;
```

The CPU player’s choice is picked via one of two methods.

The pickCpuResponse method is used for most situations and randomly chooses an answer, then asks for the next question.

The pickCpuResponseSpecialCaseLastQuestion method does the same thing but is called on the last question in the round. This is because at this point there is no next question and instead the user is taken to the shrinking zone (prior to the platform game level).

```actionscript
talkie.init(hostname, response, "start", "wait_for_click", null, this, "showShrinkingZone");
```

At the end of each round, the nextRound method is called. This method initiates the load for the next round of questions and submits the player’s responses for the previous round to the server for storage in the database.

```actionscript
_root.submitPlayerData(currentRound.roundId, roundAnswersBlind, roundAnswersSighted);
```

## Translations

The Translation.as file is used to store translated text.

Static variables are used to map array indexes to meaningful statements. There are 184 different statements that are translated at this time.

```actionscript
public static var STRING_NEW_GAME : Number = 1;
public static var STRING_HELLO_AND_WELCOME : Number = 2;
public static var STRING_SOON_WILL_VISIT_WORLD : Number = 3;
public static var STRING_BUT_FIRST_WHO_PLAY : Number = 4;
..
..
public static var STRING_PRIVACY_STATEMENT : Number = 184;
```

These correspond to indexes in an array.

The array is a multidimensional array. The first entry into the array specifies the country (e.g. [“en_en”]). The second index corresponds to the static vars.

For example, the English array starts like this;

```actionscript
translationText['en_en'][0] = "English ";
translationText['en_en'][1] = "New Game";
translationText['en_en'][2] = "Hello and welcome to the e-Bug Game Show!";
translationText['en_en'][3] = "Soon you will be visiting the weird world of the microbe.";
translationText['en_en'][4] = "But first, who do you want to play as?";
```

The Czech version starts like this:

```actionscript
translationText['cz_cz'][0] = "cz_cz";
translationText['cz_cz'][1] = "Nová hra";
translationText['cz_cz'][2] = "Ahoj, vítej v e-Bug hře!";
translationText['cz_cz'][3] = "Za chvíli navštívíš tajemný svět mikrobů.";
translationText['cz_cz'][4] = "Ale nejprve si vyber, zda budeš soutěžit jako holka nebo kluk.";
```

When this class is instantiated, it is passed the language as a String. Depending on which language is chosen, it calls the appropriate translation function.

```actionscript
public function Translations(language) {
  this.language = language;
  translationText = new Array();
  spanishTranslation = new SpanishTranslation();
  translationText[language] = new Array();
  switch ( language ) {
    case "en_en" :
      populateEnglish();
      break;
    case "gk_gk" :
      populateGreek();
      break;
```

(and so on)

Each of these populate functions simply fills the array for that language.

There is a Flash file that coordinates the actual translation, OutputXMLFilesMovie.fla

This movie contains the following ActionsScript

```actionscript
import ebug.junior.*;
var language : String = "en_en";
var translations : Translations = new Translations(getLanguage());
output.init();
function getLanguage() : String {
  return language;
}
```

As can be seen, after the Translation object has been created, an object called output is asked to init().

The output object is a class called OutputXMLFiles.as

It has hardcoded versions of each of the game’s XML files in it. When init is called, this class prints out each of the XML files, substituting the appropriate contents from the Translation arrays.

An example of one of these methods is below.

```actionscript
public function gameshowRoundOne() {
  var outputString = "<?xml version=\"1.0\" encoding=\"utf-8\" ?>\n"+
  "<round id=\"0\">\n"+
  " <name>All About Microbes</name>\n"+
  " <round_id>0</round_id>\n"+
  " <next_round>"+ _root.getLanguage() +"_gameshow_round2.xml</next_round>\n"+
  " <intro_text>\n"+
  " <blind>\n"+
  " <statement>"+ translations.getString( Translations.STRING_FIRST_BLIND_ROUND ) +"</statement>\n"+
  " <statement>"+ translations.getString( Translations.STRING_ASK_QS_NO_ANSWER ) +"</statement>\n"+
  " <statement>"+ translations.getString( Translations.STRING_BONUS_LATER ) +"</statement>\n"+
  " <statment>"+ translations.getString( Translations.STRING_LETS_GO ) +"</statment>\n"+
  " </blind>\n"+
  " <normal>\n"+
  " <statement>"+ translations.getString( Translations.STRING_QUIZ_HOVEBOARD_NATURAL ) +"</statement>\n"+
  " <statement>"+ translations.getString( Translations.STRING_QUIZ_LETS_SEE_QUESTIONS_AGAIN ) +"</statement>\n"+
  " <statement>"+ translations.getString( Translations.STRING_QUIZ_TEN_POINTS_OR_OTHER_PLAYER ) +"</statement>\n"+
  " <statement>"+ translations.getString( Translations.STRING_QUIZ_NO_KNOW_ANSWER_DONT_GUESS ) +"</statement>\n"+
  " <statement>"+ translations.getString( Translations.STRING_KITCHEN_READY_QUESTION_MARK ) +"</statement>\n"+
  " <statement>"+ translations.getString( Translations.STRING_LETS_GO ) +"</statement>\n"+
  " </normal>\n"+
  " </intro_text>\n"+
  " <questions>\n"+
  " <question id=\"0\">\n"+
  " <type>0</type>\n"+
  " <score>10</score>\n"+
  " <value>1</value>\n"+
  " <text>"+ translations.getString( Translations.STRING_QUIZ_CANNY_SEE_NO_THERE ) +"</text>\n"+
  " <answers>\n"+
  " <answer>\n"+
  " <label>"+ translations.getString( Translations.STRING_AGREE ) +"</label>\n"+
  " <value>-1</value>\n"+
  " </answer>\n"+
  " <answer>\n"+
  " <lable>"+ translations.getString( Translations.STRING_DONT_KNOW ) +"</lable>\n"+
  " <value>0</value>\n"+
  " </answer>\n"+
  " <answer>\n"+
  " <lable>"+ translations.getString( Translations.STRING_DISAGREE ) +"</lable>\n"+
  " <value>1</value>\n"+
  " </answer>\n"+
  " </answers>\n"+
  " </question>\n"+
  " <question id=\"1\">\n"+
  " <type>0</type>\n"+
  " <score>10</score>\n"+
  " <value>1</value>\n"+
  " <text>"+ translations.getString( Translations.STRING_QUIZ_BACTERIA_VIRUSES_SAME ) +"</text>\n"+
  " <answers>\n"+
  " <answer>\n"+
  " <label>"+ translations.getString( Translations.STRING_AGREE ) +"</label>\n"+
  " <value>-1</value>\n"+
  " </answer>\n"+
  " <answer>\n"+
  " <label>"+ translations.getString( Translations.STRING_DONT_KNOW ) +"</label>\n"+
  " <value>0</value>\n"+
  " </answer>\n"+
  " <answer>\n"+
  " <label>"+ translations.getString( Translations.STRING_DISAGREE ) +"</label>\n"+
  " <value>1</value>\n"+
  " </answer>\n"+
  " </answers>\n"+
  " </question>\n"+
  " <question id=\"2\">\n"+
  " <type>0</type>\n"+
  " <score>10</score>\n"+
  " <value>1</value>\n"+
  " <text>"+ translations.getString( Translations.STRING_QUIZ_FUNGI_MICROBES ) +"</text>\n"+
  " <answers>\n"+
  " <answer>\n"+
  " <label>"+ translations.getString( Translations.STRING_AGREE ) +"</label>\n"+
  " <value>1</value>\n"+
  " </answer>\n"+
  " <answer>\n"+
  " <label>"+ translations.getString( Translations.STRING_DONT_KNOW ) +"</label>\n"+
  " <value>0</value>\n"+
  " </answer>\n"+
  " <answer>\n"+
  " <label>"+ translations.getString( Translations.STRING_DISAGREE ) +"</label>\n"+
  " <value>-1</value>\n"+
  " </answer>\n"+
  " </answers>\n"+
  " </question>\n"+
  " <question id=\"3\">\n"+
  " <type>0</type>\n"+
  " <score>10</score>\n"+
  " <value>1</value>\n"+
  " <text>"+ translations.getString( Translations.STRING_QUIZ_MICROBES_ON_HANDS ) +"</text>\n"+
  " <answers>\n"+
  " <answer>\n"+
  " <label>"+ translations.getString( Translations.STRING_AGREE ) +"</label>\n"+
  " <value>1</value>\n"+
  " </answer>\n"+
  " <answer>\n"+
  " <label>"+ translations.getString( Translations.STRING_DONT_KNOW ) +"</label>\n"+
  " <value>0</value>\n"+
  " </answer>\n"+
  " <answer>\n"+
  " <label>"+ translations.getString( Translations.STRING_DISAGREE ) +"</label>\n"+
  " <value>-1</value>\n"+
  " </answer>\n"+
  " </answers>\n"+
  " </question>\n"+
  " </questions>\n"+
  "</round>\n";
  trace(outputString);
}
```

When you run the OutputXMLFiles movie, it creates a text window and outputs ALL of the XML files. To save these to disk, it is necessary to open the XML file that you want to translate in a UTF-8 compliant text editor and then copy / paste the text from this output window into the file and save. If you are doing this for a new country, you’ll need to create empty files by hand.

Just to reiterate that last point, the output xml files movie doesn’t SAVE the text, it just prints it all to screen, you must copy that text and save it manually in an XML file in order to have a translation of any of the documents.

## Potential Issues

### Hosting on a Domain Results in Game Not Loading

If you try to host the game on a new domain and have problems, it may be due to Flash’s security model. This was changed in February 2010 and I’m not 100% what the implications are.

You need to add the domain to the GameController’s list of approved domains.

```actionscript
System.security.allowDomain("http://www.e-bug.eu");
System.security.allowDomain("http://e-bug.eu");
System.security.allowDomain('*');
```

As you can see, I’ve added * as a valid domain – but I’m not sure if this works.

### You want to perform research using game data

Previously, the game submitted this data to the website. However, now that the HPA have taken control of the domain, the previous URLs no longer point to City’s server. If you want to track user performance data, this is the rough approach.

Create a web form in domino with fields that represent the data you want to collect.

Update the game to collect this data. Store all of the data in one movie clip that is created at runtime (empty) specifically for this purpose. The existing code to do this looks like:

```actionscript
submitMovie = theRoot.createEmptyMovieClip("submitMovie", theRoot.getNextHighestDepth());
submitMovie.name = player.nickname;
submitMovie.UID = player.id;
submitMovie.age = player.age;
submitMovie.sex = player.sex;
submitMovie.email = player.email;
```

When you have the movie clip full of data you want to send, you submit it to the server with code like this:

```actionscript
submitMovie.loadVariables("http://www.e-bug.eu/ebug_secret.nsf/ID_Form?CreateDocument","POST");
```

Note that the URL here should point to the form submission URL. If you are unsure what this is, view the Domino form in a web browser, view the source of the page and look for action= in the form definition – this url is the one you want.
