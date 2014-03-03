#pragma strict
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
	enum GameLevel {gameShow, kitchen1, skin1, skin2, kitchen2, gameShow_quiz1, skin11, skin12, body11, gameShow_quiz2, kitchen31, kitchen32, gameShow_quiz3, gameShow_quiz4, superinfection, gameShow_quiz5};
	
	private var level : GameLevel;			//The current level being played
	
	private var player : String; 			//To keep the name of the player chosen to play.
	
	private var goals : Goals;					//To have a reference to the Goals.js script
	
	private var isConnected : boolean;			//True if connected to the Database
	
	private var currentRoundNum : int = 1;			//Contains the current quiz round number 
	
	private var online: boolean = false;		//When this var is set to true, the scripts will be told to use the online services (such as the database access and the dialogues loading)
													//Note that this is the only var which you need to change. All other scripts points to this variable to know if they should look for the resources locally or online
	
	private var LevelLogicQuizGO: GameObject; //Reference to the active LevelLogicQuiz script.
	
	@HideInInspector
	public var db : DBconnector;		//References to the database management instance
	
	public var loadingText : GUIText;	//To show the loading progress. It's a prefab located in Assets/Prefabs/Levels/GameShow
	public var errorMessage: GUIText;		//Points to a prefab placed in Assets/Prefabs/LogicManagement. Is a GUIText to show error messages in the built versions.
	
	//private var changeStateTrigger : boolean = false;
	
	function Awake () {
	
		// Make this game object and all its transform children survive when loading a new scene.
		
		Debug.Log("***Executing the Awake() method of the GameLogic class.");
		
		DontDestroyOnLoad (transform.gameObject);
		
		db = transform.gameObject.GetComponent("DBconnector");
		
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
					currentRoundNum = 1;
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
					currentRoundNum = 4;						//Quiz level 3 will be skipped as the questions are about the kitchen level - this in which the player has to place the food correctly into the fridge
					ChangeLevel(GameLevel.kitchen31);
					break;
				case GameLevel.kitchen31:
					ChangeLevel(GameLevel.kitchen32);
					break;
				case GameLevel.kitchen32:
					ChangeLevel(GameLevel.gameShow_quiz4);
					break;
				case GameLevel.gameShow_quiz4:
					currentRoundNum = 5;
					ChangeLevel(GameLevel.superinfection);
					break;
				case GameLevel.superinfection:
					ChangeLevel(GameLevel.gameShow_quiz5);
					break;
//				case GameLevel.gameShow_quiz2:
//					currentRoundNum = 3;
//					ChangeLevel(GameLevel.gameShow_quiz2);
//					break;
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
		var levelString: String = level.ToString();
		if (levelString.Length == 14 && levelString.Substring(0, 13) == "gameShow_quiz"){	//In the case of the quiz level, we load the same stage
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