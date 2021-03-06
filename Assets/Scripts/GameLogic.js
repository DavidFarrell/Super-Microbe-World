﻿#pragma strict
/*
This MonoBehaviour will be attached to a GameObject which will be created in the first scene loaded of the game and will survive until the end of the game through all its levels.

Its function is to serve as the controller of all the game logic.
It will be used to control the levels that are loaded, and to keep the information that must pass from level to level.

***********************
-How to add new levels?
***********************
	1/ Create the scene.
		The easiest way of doing it is duplicating one existing scene (click on the scene and press CMD+D or Ctrl+c on windows) and modifying it.
		Note that there are some changes to be done to the duplicated class, like changing the script attached to the LevelLogic object contained in the scene to a newly created script (inheriting to LevelLogic class)
	2/Copy the exact name of the scene on the GameLevel enum variable
		It's important that the new field added to the enum has the same name than the scene created as it'll be used to load it and if it's different, the scene won't be loaded.
	3/Modify the NextLevel() function placed a few lines below to link from one state to the newly introduced level, and from the new level to the following.
		
		
TODO Check the comments of this class
*/
import Boomlagoon.JSON;

public class GameLogic extends MonoBehaviour{
	
	//This enum type will contain the EXACT name of all the scenes of the game.				IMPORTANT
	enum GameLevel {gameShow, gameShow_quiz1b, kitchen1, skin1, skin2, kitchen2, gameShow_quiz1, gameShow_quiz2b, skin11, skin12, body11, gameShow_quiz2, gameShow_quiz3b, kitchen31, kitchen32, gameShow_quiz3, gameShow_quiz4, gameShow_quiz5b, superinfection, gameShow_quiz5, gameShow_game_end};	//The quiz round 4 is never shown because it's about the kitchen game, which is not implemented yet.
	
	private var level : GameLevel;			//The current level being played
	
	private var player : String; 			//To keep the name of the player chosen to play.
	
	private var goals : Goals;					//To have a reference to the Goals.js script
	
	@HideInInspector
	public var isConnected : boolean;			//True if connected to the Database
	
	private var currentRoundNum : int = 1;			//Contains the current quiz round number 
	
	private var online: boolean = false;		//When this var is set to true, the scripts will be told to use the online services (such as the database access and the dialogues loading)
													//Note that this is the only var which you need to change. All other scripts points to this variable to know if they should look for the resources locally or online
	
	private var LevelLogicQuizGO: GameObject; //Reference to the active LevelLogicQuiz script.
	
	@HideInInspector
	public var db : DBconnector;		//References to the database management instance
	
	public var loadingText : GUIText;	//To show the loading progress. It's a prefab located in Assets/Prefabs/Levels/GameShow
	public var errorMessage: GUIText;		//Points to a prefab placed in Assets/Prefabs/LogicManagement. Is a GUIText to show error messages in the built versions.
	
	public var ShowBlindRounds : boolean = false;	//If "true", the blind round of questions will be shown before playing the level. If "false", blind round questions won't be shown. 
	
	//private var changeStateTrigger : boolean = false;
	
	function Awake () {
	
		// Make this game object and all its transform children survive when loading a new scene.
		
		Debug.Log("***Executing the Awake() method of the GameLogic class.");
		
		DontDestroyOnLoad (transform.gameObject);
		
		db = transform.gameObject.GetComponent("DBconnector");
		
//		db.AwakeServer();	//Not needed if the game is executed from the webserver
		
		player = "";
		
		level = GameLevel.gameShow;
		
		goals = transform.gameObject.GetComponent("Goals");					//The Goals.js script is attached to the GameLogic gameobject. will be used to keep track of the goals of the level
		
		isConnected = false;
		
		loadingText = Instantiate(loadingText);
		loadingText.enabled = false;
		errorMessage = Instantiate(errorMessage);
		errorMessage.enabled = false;
		
//		Debug.Log("GameLogic.Awake: Setting the stored scores of the players to 0");
		PlayerPrefs.SetInt("PlayerScore", 0);
		PlayerPrefs.SetInt("OpponentScore", 0);
		
	}
	
	function Start () {
		
	}

	function Update () {
		if (Input.GetKeyDown(KeyCode.W)){	//To activate or deactivate the blind round question
			if (ShowBlindRounds){
				ShowBlindRounds = false;
				PrintError("Blind rounds disabled", 2);
			}else{
				ShowBlindRounds = true;
				PrintError("Blind rounds enabled", 2);
			}
		}
	}

	function OnGUI() {
		
	}
	
	//Here is where new levels (Unity3D calls them "scenes") must be added
	//This is the function to be called from every LevelController when finished the level to load the following.
	//TODO probably some modification has to be made in the future to add an argument to pass the punctuation of the level and if it was succesfully completed or not
	public function NextLevel() {
		
		if (goals.GoalsAchieved()) {		//If all the goals for the level are completed, goes to the next level
			//Debug.Log("GameLogic.NextLevel: All goals achieved. Going to the next Level.");
			switch (level){
				
				case GameLevel.gameShow:
					currentRoundNum = 1;									//The next question round will be the number 1.
				 	if (!ShowBlindRounds) ChangeLevel(GameLevel.kitchen1);
				 	else ChangeLevel(GameLevel.gameShow_quiz1b);			//if we should load the blind round level.
					break;
				
				case GameLevel.gameShow_quiz1b:
					ChangeLevel(GameLevel.kitchen1);
					break;
				
				case GameLevel.kitchen1:
					ChangeLevel(GameLevel.skin1);
					break;
				case GameLevel.skin1:
					ChangeLevel(GameLevel.skin2);
					break;
				case GameLevel.skin2:
					ChangeLevel(GameLevel.kitchen2);
					break;
				case GameLevel.kitchen2:
					ChangeLevel(GameLevel.gameShow_quiz1);
					break;
					
				case GameLevel.gameShow_quiz1:
					currentRoundNum = 2;
					if (!ShowBlindRounds) ChangeLevel(GameLevel.skin11);
				 	else ChangeLevel(GameLevel.gameShow_quiz2b);			
					break;
				case GameLevel.gameShow_quiz2b:
					ChangeLevel(GameLevel.skin11);
					break;
				
				case GameLevel.skin11:
					ChangeLevel(GameLevel.skin12);
					break;
				case GameLevel.skin12:
					ChangeLevel(GameLevel.body11);
					break;
				case GameLevel.body11:
					ChangeLevel(GameLevel.gameShow_quiz2);
					break;

				case GameLevel.gameShow_quiz2:
					currentRoundNum = 3;						//Quiz level 4 will be skipped as the questions are about the kitchen level - this in which the player has to place the food correctly into the fridge
					if (!ShowBlindRounds) ChangeLevel(GameLevel.kitchen31);
				 	else ChangeLevel(GameLevel.gameShow_quiz3b);			
					break;
				case GameLevel.gameShow_quiz3b:
					ChangeLevel(GameLevel.kitchen31);
					break;
					
				case GameLevel.kitchen31:
					ChangeLevel(GameLevel.kitchen32);
					break;
				case GameLevel.kitchen32:
					ChangeLevel(GameLevel.gameShow_quiz4);
					break;
				
				case GameLevel.gameShow_quiz4:				//It's actually level 3, because the 4th is the one in which the questions are about how to store the food in the kitchen. So the level is correct but the name is written wrong.
					currentRoundNum = 5;
					if (!ShowBlindRounds) ChangeLevel(GameLevel.superinfection);
				 	else ChangeLevel(GameLevel.gameShow_quiz5b);			
					break;
				case GameLevel.gameShow_quiz5b:
					ChangeLevel(GameLevel.superinfection);
					break;
					
				case GameLevel.superinfection:
					ChangeLevel(GameLevel.gameShow_quiz5);
					break;
				case GameLevel.gameShow_quiz5:
					ChangeLevel(GameLevel.gameShow_game_end);
					break;
				default:
					Debug.Log("Game finished");
					Application.Quit();				//As this game is going to be built as a web application there is no sense on exiting the application. So We'll have to show some kind of ending screen.
					//Code that will be executed if level didn't match any case condition.
			}
		}
		else{
			//TODO Show a message to tell the player to complete remaining goals.
			Debug.Log("GameLogic.NextLevel: There is still some goal to complete...");
		}
	}
	
	private function ChangeLevel(newLevel : GameLevel){
		//Here's why is so important that the name of the level var is the same than the scene
		level = newLevel;
		
		//Testing this feature:
		Resources.UnloadUnusedAssets();		//This will delete any object that is supposed not to be used again. Just testing it, maybe it is not only not useful but also costful to use!. Documentation can be found here: http://docs.unity3d.com/Documentation/ScriptReference/Resources.UnloadUnusedAssets.html
		
		var levelString: String = level.ToString();
		if ((levelString.Length == 14 || levelString.Length == 15) && levelString.Substring(0, 13) == "gameShow_quiz"){	//In the case of the quiz level, we load the same stage
		Debug.Log("GameLogic.ChangeLevel: Loading a quiz level! number " + currentRoundNum);
			if (Application.CanStreamedLevelBeLoaded ("gameShow_quiz")){
				Application.LoadLevel("gameShow_quiz");		//Which round of questions to load will be asked later inside the quiz level scripts.
			}else{
				//showProgress = true;	//This will activate the gui to show the progress
				level.ToString("gameShow_quiz");
			}	
		}
		else{
			Debug.Log("GameLogic.ChangeLevel: Loading a non quiz level");
			if (Application.CanStreamedLevelBeLoaded (level.ToString())){
				Application.LoadLevel(level.ToString());
			}else{
				//showProgress = true;
				updateProgress(level.ToString());
			}
		}
				
	}
	
	private function updateProgress(level: String){
		var progress : float;
		loadingText.enabled = true;
		while(!Application.CanStreamedLevelBeLoaded (level)){
			progress = Application.GetStreamProgressForLevel(level) * 100;
			loadingText.text = "Loading... " + progress;
			yield new WaitForSeconds(0.1);
		}
		Application.LoadLevel(level);
	}
	
	//This function is intended to show an error printed on the screen using the GUIText errorMessage.
	//It will be useful to show errors on the built version of the game.
	public function PrintError(error: String){
		errorMessage.text = error;
		errorMessage.enabled = true;
	}
	
	public function PrintError(error: String, time: int){
		PrintError(error);
		yield new WaitForSeconds(time);
		DeleteError();
	}
	
	public function DeleteError(){
		errorMessage.text = "";
		errorMessage.enabled = false;
	}
	
	//will be called if the player dies
	public function RestartLevel(){
		ChangeLevel(level);
		
	}
	
	public function PlayerChosen(playerName : String){
		//Sets the player for the rest of the game
		//Each time a new platform level is loaded, its script will look into PlayerPrefs to see which player to load, and if it's empty will load Harry by default
		player = playerName;
		PlayerPrefs.SetString("player", playerName);
		
	
	}
	
	//Here we'll connect for the first time with the database. 
	//Here must be treated the data that the player wrote in the form (nickname, age and mail)
	public function StartDataBaseConnection (nickname : String, age : String, email : String) {
		
		
		
		var userid : String = nickname;
		var session : String = "testdecembersmb";				//This session has to be created in the database.
		
		if(!db.connected){
			if (PlayerPrefs.HasKey("sessionKey")) PlayerPrefs.DeleteKey("sessionKey");
			
			yield db.ConnectToGleaner(userid, session); //in the server we can check this keyword to allow only people who are using our game to connect to the database
			
			if (PlayerPrefs.HasKey("sessionKey")) {
				Debug.Log('DBConnector.ConnectGleaner()-> sessionKey received: \n' + PlayerPrefs.GetString("sessionKey"));	
				isConnected = true;
			}
			else{
				Debug.Log('DBConnector.ConnectGleaner()-> sessionKey not received yet.');
				Debug.Log('DBConnector.ConnectGleaner()-> Waiting 1 second...');
				
				yield new WaitForSeconds(1);
				
				if (PlayerPrefs.HasKey("sessionKey")) {
					Debug.Log('DBConnector.ConnectGleaner()-> sessionKey received at second attempt: \n' + PlayerPrefs.GetString("sessionKey"));
					isConnected = true;
				}
				else{
					Debug.Log('DBConnector.ConnectGleaner()-> sessionKey not received at second attempt.\n Check the internet connection or the server.');
				}
			}
			if (PlayerPrefs.HasKey("sessionKey")) {		//If finally we're connected, we'll send a track with the data of the player
				if(Debug.isDebugBuild) Debug.Log("Sending the first trace to the database...");
				var firstTrack: JSONObject = new JSONObject();	//Sending the track to the database..
				firstTrack.Add("type", "logic");
				firstTrack.Add("event", "Player started the game.");
				firstTrack.Add("nickname", nickname);
				firstTrack.Add("email", email);
				firstTrack.Add("age", age);
				var tracks : JSONObject[] = new JSONObject[1];
				if (!firstTrack || ! tracks) Debug.LogError("Unable to create JSONObject or array");
				tracks[0] = firstTrack;
				db.Track(tracks);
			}
			
		}
		else{
			Debug.Log('DBConnector.ConnectGleaner() -> Connected already. SessionKey = ' + PlayerPrefs.GetString("sessionKey"));
		}
//		if (PlayerPrefs.HasKey("sessionKey")) {
//				Debug.Log('DBConnector.ConnectGleaner()-> sessionKey received: \n' + PlayerPrefs.GetString("sessionKey"));
//		}
		
	}
	
	//returns true if the connection was established (i.e. the sessionkey was received) and we can post tracks on the database
	public function checkConnection() : boolean {
	
//		return (PlayerPrefs.HasKey("sessionKey"));
//		return isConnected;
		
		if (db.connected) isConnected = true;
		
		return isConnected;
	
	}
	
	public function checkOnLine(){
		return online;
	}
	
	public function GetRoundNumber(): int{
		//This function is to be called from the LevelLogicQuizGame to know which one is the current round
		//The first level is the level 1 and will return -1 if there was a problem
		if(currentRoundNum<1 || currentRoundNum > 5) Debug.LogError("Round number is out of bounds!"); 
		Debug.Log("********* Round number: "+currentRoundNum+" ********");
		return currentRoundNum;
		
	}
	
	public function IsBlindRound(): boolean{
		//This function will be called from the LevelLogicQuiz.js script to see if the current QUIZ LEVEL is blind or not.
		//Will return yes if ShowBlindRounds == true and the current level is of a blind question round. Will also return true if ShowBlindRounds == true and we'e in the gameShow level
		//Normal quiz levels have names like gameShow_quiz1, and blind levels have names like gameShow_quiz1b 
		var levelString: String = level.ToString();
		if (!ShowBlindRounds) {
			return false;
			Debug.Log("IsBlindRound == FALSE");
		}else{
			if (levelString.Length == 15 && levelString.Substring(0, 13) == "gameShow_quiz"){
					Debug.Log("IsBlindRound == TRUE");
					return true;
			}
			else{
				if(levelString.Length == 8 && levelString == "gameShow"){
					Debug.Log("IsBlindRound == TRUE");
					return true;
				}else{
					Debug.Log("IsBlindRound == FALSE");
					return false;
				}
			}
		}
	}//end of function
	
	public function IsBlindGame(): boolean{
		//will return if the current game is a blind game or not.
		return ShowBlindRounds;
	}//end of function
	
	public function IsLastRound(){
		//Returns true if the current level is the last question round. This way we will know if we should show the shrinking animation or not.
		return (level == GameLevel.gameShow_quiz5);
	}
	
//	public function GetQuestions(){
//		//This class begins the process of getting the round object containing the questions and answers
////		return Round.LoadRoundFromXMLResources(currentRoundNum);
////		Round myRound = new Round();
//		
//		var roundH : RoundHandler = new RoundHandler();
//		
//		if (online && isConnected){
//			roundH.LoadRoundFromWeb(currentRoundNum);			//requesting the dialogue from a server
//		}else{
//			roundH.LoadRoundFromXMLResources(currentRoundNum);	//reading the dialogues locally
//		}
//	}
//	
//	public function ReceiveRound(myRound: Round){
//		//This function will be called from the RoundHandler function when the Round Object containing the questions of the quiz is ready
//		//It will pass the Round object to the LevelLogicQuiz script to start printing it on the script.
//		
//		Debug.Log("GameLogic: round received. Giving it to the LevelLogicQuiz level.");
//
//		
//		var script: LevelLogicQuiz = transform.gameObject.Find("LevelLogic").GetComponent("LevelLogicQuiz");
//		script.ReceiveRound(myRound);
//		
//	}
	
//	public function SubmitQuizResults(results : List.<int>){
//		//results will have on each component 1 if it was answered correctly by the player and -1 if it was failed. 0 will be stored if the player didn't know.
//		Debug.Log("*** SubmitQuizResults(): Feature not implemented yet!");
//	}
	
	public function GetLevelName(): String{
		return level.ToString();
	}
		
}	//End of class brace


/*

-State machine									|	done

-Read from xml									|	Done / look the Rounds.js file. It reads the xmls containing the rounds of questions

-Write the text on screen						|	Done

-Update scoreboards								|	done

-Update Animations								|	done

-Login the player								|	done

-Track the traces to the tracking system		|	done

-Show a window to choose the answers			|	done

*/