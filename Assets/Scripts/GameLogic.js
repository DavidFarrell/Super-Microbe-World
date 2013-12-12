#pragma strict
/*
This MonoBehaviour will be attached to a GameObject which will be created in the first scene loaded of the game and will survive until the end of the game through all its levels.

Its function is to serve as the controller of all the game logic.
It will be used to control the levels that are loaded, and to keep the information that must pass from level to level.

TODO Check the comments of this class
*/
public class GameLogic extends MonoBehaviour{
	
	//This enum type will contain the EXACT name of all the scenes of the game.
	enum GameLevel {gameShow, kitchen1};
	
	private var level : GameLevel;
	
	private var player : String; 			//To keep the name of the player chosen to play.
	
	//private var changeStateTrigger : boolean = false;
	
	function Awake () {
	
		// Make this game object and all its transform children survive when loading a new scene.
		DontDestroyOnLoad (transform.gameObject);
		
		player = "";
		
		level = GameLevel.gameShow;
	
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
	
		switch (level){
			
			case GameLevel.gameShow:
			 	ChangeLevel(GameLevel.kitchen1);
				break;
			default:
				;
				//Code that will be executed if level didn't match any case condition.
		}
	
	}
	
	private function ChangeLevel(newLevel : GameLevel){
		level = newLevel;
		Application.LoadLevel(level.ToString());
	}
	
	public function PlayerChosen(playerName : String){
	
		player = playerName;
		PlayerPrefs.SetString("player", playerName);
	
	}
}
/*

-State machine									|	

-Read from xml									|	

-Write the text on screen						|	Done

-Update scoreboards								|	

-Update Animations								|	

-Login the player								|	

-Track the traces to the tracking system		|	

-Show a window to choose the answers			|	

*/