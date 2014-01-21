#pragma strict
/*
This MonoBehaviour will be attached to a GameObject which will be created in the first scene loaded of the game and will survive until the end of the game through all its levels.

Its function is to serve as the controller of all the game logic.
It will be used to control the levels that are loaded, and to keep the information that must pass from level to level.

TODO Check the comments of this class
*/
public class GameLogic extends MonoBehaviour{
	
	//This enum type will contain the EXACT name of all the scenes of the game.				IMPORTANT
	enum GameLevel {gameShow, kitchen1, gameShow_round1};
	
	private var level : GameLevel;			//The current level being played
	
	private var player : String; 			//To keep the name of the player chosen to play.
	
	private var goals : Goals;					//To have a reference to the Goals.js script
	
	//private var changeStateTrigger : boolean = false;
	
	function Awake () {
	
		// Make this game object and all its transform children survive when loading a new scene.
		DontDestroyOnLoad (transform.gameObject);
		
		player = "";
		
		level = GameLevel.gameShow;
		
		goals = transform.gameObject.GetComponent("Goals");					//The Goals.js script is attached to the GameLogic gameobject. will be used to keep track of the goals of the level
	
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
			Debug.Log("All goals achieved. Going to the next Level.");
			switch (level){
				
				case GameLevel.gameShow:
				 	ChangeLevel(GameLevel.kitchen1);
					break;
				
				case GameLevel.kitchen1:
					ChangeLevel(GameLevel.gameShow_round1);
					break;
				
				default:
					Debug.Log("Game finished");
					Application.Quit();				//As this game is going to be built as a web application there is no sense on exiting the application. So We'll have to show some kind of ending screen.
					//Code that will be executed if level didn't match any case condition.
			}
		}
		else{
			//TODO Show a message to tell the player to complete remaining goals.
			Debug.Log("There is still some goal to complete...");
		}
	}
	
	private function ChangeLevel(newLevel : GameLevel){
		//Here's why is so important that the name of the level var is the same than the scene
		level = newLevel;
		Application.LoadLevel(level.ToString());
		
	}
	
	public function PlayerChosen(playerName : String){
		//Sets the player for the rest of the game
		player = playerName;
		PlayerPrefs.SetString("player", playerName);
		
	
	}
	
	//Here we'll connect for the first time with the database. 
	//Here must be treated the data that the player wrote in the form (nickname, age and mail)
	public function StartDataBaseConnection (nickname : String, age : String, email : String) {
		
		var userid : String = nickname;
		var session : String = "testdecembersmb";				//This session has to be created in the database.
		
		if(!DBconnector.connected){
			if (PlayerPrefs.HasKey("sessionKey")) PlayerPrefs.DeleteKey("sessionKey");
			
			yield DBconnector.ConnectToGleaner(userid, session); //in the server we can check this keyword to allow only people who are using our game to connect to the database
			
			if (PlayerPrefs.HasKey("sessionKey")) {
				Debug.Log('DBConnector.ConnectGleaner()-> sessionKey received: \n' + PlayerPrefs.GetString("sessionKey"));	
			}
			else{
				Debug.Log('DBConnector.ConnectGleaner()-> sessionKey not received yet.');
				Debug.Log('DBConnector.ConnectGleaner()-> Waiting 1 second...');
				
				yield new WaitForSeconds(1);
				
				if (PlayerPrefs.HasKey("sessionKey")) {
					Debug.Log('DBConnector.ConnectGleaner()-> sessionKey received at second attempt: \n' + PlayerPrefs.GetString("sessionKey"));
				}
				else{
					Debug.Log('DBConnector.ConnectGleaner()-> sessionKey not received at second attempt.\n Check the internet connection or the server.');
				}
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
	
		return (PlayerPrefs.HasKey("sessionKey"));
	
	}
	
	public function GetRoundNumber(): int{
		//This function is to be called from the LevelLogicQuizGame to know which one is the current round
		//The first level is the level 0 and will return -1 if there was a problem
		
		if(level == GameLevel.gameShow_round1)
			return 0;
		else
			return -1;
		
	}
		
}	//End of class brace


/*

-State machine									|	done

-Read from xml									|	Done / look the Rounds.js file

-Write the text on screen						|	Done

-Update scoreboards								|	done

-Update Animations								|	done

-Login the player								|	done

-Track the traces to the tracking system		|	done

-Show a window to choose the answers			|	

*/