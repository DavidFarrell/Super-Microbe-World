#pragma strict

/*

This class contains the main structure for the logic of the _platform_ levels.

It's used to keep all the scripts controlling the actions and behaviours on the levels (called level logic scripts) homogeneous.

This class must not be used directly, but inherited from the level logic classes of every level so as it can serve as an interface for them.

The reason why this is a class and not an interface is that this way we're able to write in this class some common behaviours if neccesary and use them from the inherited classes.

*/
import Boomlagoon.JSON;

public class LevelLogic extends MonoBehaviour{
	
	public var amy: GameObject;				//Drag and drop the prefabs of the players into this variables in the editor
	public var harry: GameObject;

	private var player: GameObject;
	private var playerName: String;
	private var playerScript: playerController;

	private var myCamera: Transform;
	private var minXYTransform: Transform;
	private var maxXYTransform: Transform;

	protected var myTransform: Transform;

	protected var gameLogic : GameLogic;			//To keep a reference to the GameLogic.js script
	protected var goals : Goals;					//To have a reference to the Goals.js script
	
	function Awake () {
	
		myTransform = transform;
		
		var gameLogicGO : GameObject;
		gameLogicGO = GameObject.Find("GameLogic");
		if (gameLogicGO){
			gameLogic = gameLogicGO.GetComponent("GameLogic");					//BE CAREFUL!! GameLogic is a GameObject that is created in the first scene and is never destroyed when changing between scenes!
																				//That means that if this scene is played directly there will be here a null reference!!!!!!!
			goals = gameLogicGO.GetComponent("Goals");					//The Goals.js script is attached to the GameLogic gameobject. will be used to keep track of the goals of the level
		}																				
		else{
			Debug.LogError("GameLogic Object not found. This will be because GameLogic is created in the first level of the game, the GameShow level, and is intended to pass (be kept alive) throughout all the scenes in the game. So, if the Kitchen level is played, this object won't exist, and there must be many Null reference errors. But none of this errors will avoid playing the game. ");
		}
		
		
		
		if(!amy || !harry) Debug.LogError("Missing player's prefab. Please add the prefabs of the players to the level logic script controlling this level.");
		
		var start: Transform = myTransform.Find("level_start");			//Looks for the start_point GameObject, that is (or should be) a son of the GameObject this script is attached to.
		
		myCamera = myTransform.Find("main_camera");
		minXYTransform = myTransform.Find("main_camera_LowerLeftEdge").transform;
		maxXYTransform = myTransform.Find("main_camera_UpperRightEdge").transform;
		
		if (!start){													//It checks if start exists. Start is a gameObject that will be used to place the player initially
			Debug.LogError("Start point not found.");
		}
		else{
			if (PlayerPrefs.HasKey("player"))							//We'll instantiate amy or harry depending on which one was selected in the initial scene.
				playerName = PlayerPrefs.GetString("player");
			else{
				Debug.LogError("'player' attribute not found in the PlayerPrefs. Using Harry as default.");
				playerName = "Harry";
			}
			if (playerName == "Harry"){									//To instantiate Harry
				player = Instantiate(harry, start.transform.position,  Quaternion.identity);
			}
			else{														//To instantiate Amy
				player = Instantiate(amy, start.transform.position,  Quaternion.identity);
			}
			
			playerScript = player.GetComponent(playerController);
			if(!playerScript) Debug.LogError("Couldn't reach the player's script");
		}
	}
	
	function Start () {
		myCamera.SendMessage("SetPlayer", player.transform);							//Sets the camera's center to the player once the camera is instanced
		var minXY: Vector2 = minXYTransform.position;									//The bounds of the camera are fixed
		var maxXY: Vector2 = maxXYTransform.position;
		myCamera.SendMessage("SetBounds", new CameraBounds(maxXY, minXY)); 	//To set the boundaries of the camera
		
		SendInfo();			//Sends info to the database to notifies that this level was started
		
		AddLevelGoals();		//Function to add the goals of this level
	}
	
	public class CameraBounds{		//The purpose of this class is to keep the settings of the camera in an object, so we'll be able to send this settings to the camera game object using the SendMessage() function
									//which only accepts one argument to be passed
		public var maxXandY: Vector2;
		public var minXandY: Vector2;
		
		public function CameraBounds(maxXY: Vector2, minXY: Vector2){
			maxXandY = maxXY;
			minXandY = minXY;
		}
	}

	function Update () {
		
		if (Input.GetKeyDown(KeyCode.Q)){	//This is a shortcut to skip a level by pressing the letter "q"
			Debug.Log("Letter 'q' pressed. Going to next level...");
			goals.CompleteAllGoals();
			gameLogic.NextLevel();
		}
		
	}
	
	protected function AddLevelGoals () {
		//Function to add the goals of this level. Override this function in the scripts that inherit from this one.
		// e.g. goals.SetGoals("lucy", "photo", 3);			//The goal will be to take pictures to 3 lucy bacteria

	}
	
	//Modifies the number of pickups of the player
	protected function SetPickups(soap: int, whitebc: int, antibiotics: int){
		playerScript.SetPickups(soap, whitebc, antibiotics);
	}
	
	private function SendInfo(){
		//yield new WaitForSeconds(2);
		if (gameLogic.checkConnection()){			//If we are authenticated in the web service
			var firstTrack: JSONObject = new JSONObject();	//Sending the track to the database..
			firstTrack.Add("type", "logic");
			firstTrack.Add("event", "Level " + gameLogic.GetLevelName() + " loaded");
			var tracks : JSONObject[] = new JSONObject[1];
			//if (!firstTrack || ! tracks) Debug.LogError("Unable to create JSONObject or array");
			tracks[0] = firstTrack;
			gameLogic.db.Track(tracks);
		}
		else{
			Debug.Log("Connection not established (sessionKey not found) when trying to post the first trace.");
		}
	}

}