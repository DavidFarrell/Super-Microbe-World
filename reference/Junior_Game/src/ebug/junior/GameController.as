import ebug.*;
import ebug.general.*;
import ebug.junior.*;
import ebug.util.AssetLibrary;
import flash.display.BitmapData;

class ebug.junior.GameController {
	
	var theRoot : MovieClip;
	var theStage : MovieClip;
	
	var player : Player ;

	//var game:Game;
	var gameScreen:MovieClip;
	var fadeTime; 
	var fadingScreenOut:Boolean;
	var gameInterval:Number;
	var screensLoaded : Number;
	var firstTimeHoverboard : Boolean;
	var round : Number;
	var gameStructure : Object;
	//var loadListener:Object = new Object();
	
	// load all required swfs
	var gameshowHolder : MovieClip ;
	var gameShow : GameShow;

	var hoverboardHolder : MovieClip ;
	var hoverboardGame : PlatformGame;
	var splashHolder : MovieClip ;
	var cutsceneHolder : MovieClip 
	var summaryPageHolder : MovieClip;
	var kitchenGameHolder : MovieClip;
	
	var submitMovie : MovieClip;
	
	var assetLoader : AssetLibrary;
	
	function GameController(theRoot : MovieClip, theStage : MovieClip) {
		this.theStage = theStage;
		this.theRoot = theRoot;
		
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
		
		assetLoader = new AssetLibrary(theRoot, theStage, "", theRoot["loader"], theStage, "Looding");
	}
	
	function init() {
		// each level added here is a start level.
		gameStructure.hoverboardLevels.push("alpha_level1.xml");
		gameStructure.hoverboardLevels.push("alpha_level5.xml");
		gameStructure.hoverboardLevels.push("alpha_level8.xml");
		gameStructure.hoverboardLevels.push("NULL_KITCHEN_GAME");
		gameStructure.hoverboardLevels.push("alpha_level10.xml");

		// the actual show is the child of the movie clip - hence this pairing
		gameshowHolder= theRoot.createEmptyMovieClip("gameshow_holder", theRoot.getNextHighestDepth())
		hoverboardHolder= theRoot.createEmptyMovieClip("hoverboardHolder", theRoot.getNextHighestDepth());
		splashHolder = theRoot.createEmptyMovieClip("splash", theRoot.getNextHighestDepth());
		cutsceneHolder = theRoot.createEmptyMovieClip("cutscene_intro", theRoot.getNextHighestDepth());
		summaryPageHolder = theRoot.createEmptyMovieClip("summaryPageHolder", theRoot.getNextHighestDepth());
		kitchenGameHolder = theRoot.createEmptyMovieClip("kitchenGameHolder", theRoot.getNextHighestDepth());
//		contentLoader.loadClip("eBugGameShow.swf", gameshowHolder);

		assetLoader.setLoadingText("loading...");
		//	function loadAssets(callbackObject : Object, callbackFunction : String, loadList : Array) {
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
	
	/* 
	 * NewGame is called via _root.newGame from the splash fla's button
	 */
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
		submitMovie.loadVariables("http://www.e-bug.eu/ebug_secret.nsf/ID_Form?CreateDocument","POST");
		
		
		cutsceneHolder.unloadMovie();
		
		// remove
		//nextHoverboardRound();
		
		gameShow.player = player;
		gameshowHolder._visible = true;
		gameshowHolder._alpha = 100;
		gameshowHolder.play();
		//gameShow.play();
		//gameShow.init();
		//gameShow._visible = false;
	}
	
	function timestamp() {
		
		var date : Date = new Date();
		var stamp : String = date.getUTCYear() + "" + date.getUTCMonth() + "" + date.getUTCDay() + "" + date.getUTCHours() + "" + date.getUTCMinutes() + "" + date.getUTCSeconds() + "" + date.getUTCMilliseconds();
		return stamp;
		
	}
	
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
	
	function getPlayer() {
		return player;
	}
	
	function setGameShow(gameShow : GameShow) {
		this.gameShow = gameShow;
	}
	
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
	
	function showKitchen() {
		clearInterval(gameShow.interval);
		gameshowHolder._visible = false;
		
		kitchenGameHolder._visible = true;
		kitchenGameHolder._alpha = 100;
		//trace("show hb - goign to root nhr");
	//	nextHoverboardRound() ;
	}
	
	function showHoverboard() {
		clearInterval(gameShow.interval);
		gameshowHolder._visible = false;
		
		hoverboardHolder._visible = true;
		hoverboardHolder._alpha = 100;
		//trace("show hb - goign to root nhr");
		nextHoverboardRound() ;
	}

	function nextHoverboardRound() {
		hoverboardHolder._visible = true;
		summaryPageHolder._visible = false;
		trace("New Hoverboard round for: " + player.nickname + ", round " + round +",  " + gameStructure.hoverboardLevels[round]);
			
		if ( firstTimeHoverboard ) {
			firstTimeHoverboard = false;
			// hoverboard movie clip calls initialiseGame itself so set movie clip player
			hoverboardHolder.player = getPlayer();
			
		
			hoverboardGame.roundStartPlayer = getPlayer();
			hoverboardGame.roundStartLevel = gameStructure.hoverboardLevels[round];
			hoverboardHolder.play();
		} else {
			round++;
			hoverboardGame.roundStartLevel = gameStructure.hoverboardLevels[round];
			hoverboardGame.roundStartPlayer = getPlayer();
			hoverboardGame.initialiseGame(getPlayer(),gameStructure.hoverboardLevels[round], hoverboardGame.mapBuilder.tilesList);
			// hack? why does below line not work?  have to recreate it ratehr than callign main
			//		hoverboardHolder.gotoAndStop("main");
			hoverboardHolder.gameInterval = setInterval(hoverboardHolder, "loop", 15);
				
		}
		
	}

	function restartHoverboardRound() {
		clearInterval(hoverboardHolder.gameInterval);
		summaryPageHolder._visible = false;
		hoverboardGame.restartRound();
		hoverboardHolder._visible = true;
		hoverboardHolder.gameInterval = setInterval(hoverboardHolder, "loop", 15);
	}
	
	function endOfKitchen(updatedPlayer : Player) {
		trace ("updated player has " + updatedPlayer.score + " vs " + player.score);
	//	clearInterval(hoverboardHolder.gameInterval);
	trace("end of kitchen in controller");
		gameshowHolder._visible = true;
		gameShow._visible = true;
		kitchenGameHolder._visible = false;
		gameShow.startNonBlindRound();
	}

	function endofHoverboard(reason : Number) {
		if ( reason == PlatformGame.END_REASON_DIE ) {
			clearInterval(hoverboardHolder.gameInterval);
			summaryPageHolder.text0.text = "You Died!";
			summaryPageHolder.text1.text = "click to try again";
			summaryPageHolder._visible = true;
			summaryPageHolder._alpha = 100;
			summaryPageHolder.callObj = this;
			summaryPageHolder.callFunc = "restartHoverboardRound";
		} else if ( reason == PlatformGame.END_REASON_TIME ) {
			clearInterval(hoverboardHolder.gameInterval);
			summaryPageHolder.text0.text = "You ran out of time.";
			summaryPageHolder.text1.text = "click to try again";
			summaryPageHolder._visible = true;
			summaryPageHolder._alpha = 100;
			summaryPageHolder.callObj = this;
			summaryPageHolder.callFunc = "restartHoverboardRound";
		} else {
			clearInterval(hoverboardHolder.gameInterval);
			gameshowHolder._visible = true;
			gameShow._visible = true;
			hoverboardHolder._visible = false;
			
			gameShow.startNonBlindRound();
		}
	}

	function registerHoverboard(game : PlatformGame) {
		
		hoverboardGame = game;
		/* this is commented out due to resulting in double player. 
		hoverboardHolder.level = gameStructure.hoverboardLevels[0];
		hoverboardHolder.player = player;
		hoverboardHolder.gotoAndPlay("start");
		*/
	}


	/*function nextHoverboardRound() {
	//	hoverboardGame.initialiseGame(player,level.next, mapBuilder.tilesList);
	}*/

	function exit() {
		trace("root exit");
		theRoot.gotoAndPlay("init");
	}

	//contentLoader.loadClip("introductionToMicrobes_mainMenu.swf", gameScreen);

	//trace("init game");
	//gotoGameScreen("introductionToMicrobes_mainMenu.swf");

	// functions
	/*
	function fadeToNextGameScreen() {
		if (fadingScreenOut) {
			trace ("Fading out: " +gameScreenName + " at: " + gameScreen._alpha + " - " + gameScreen._visible );
		} else {
			trace ("Fading IN: " + gameScreenName + " at: " + gameScreen._alpha + " - " + gameScreen._visible );
		}
		if (fadingScreenOut) {
			gameScreen._alpha -= 10;
			if (gameScreen._alpha <= 0) {
				unloadMovie(gameScreen);
				contentLoader.loadClip(gameScreenName, gameScreen);
				
				fadingScreenOut = false;
			}
		} else {
			gameScreen._alpha += 10;
			if (gameScreen._alpha >= 100) {
				clearInterval(gameInterval);
				gotoAndStop("game");
			}
		}
	}

	function gotoGameScreen(newScreen:String):Void {
		trace("gotoGameScreen:" + newScreen);
		if (newScreen != gameScreenName) {
			gameScreenName = newScreen;
			//pdaScreen = "";
			//shrinkScreen = "";
			fadingScreenOut = true;
			clearInterval(gameInterval);
			gameInterval = setInterval(fadeToNextGameScreen, fadeTime);
		} else {
			//trace("gotoGameScreen: matched currentScreen");
		}
	}


*/

	
}