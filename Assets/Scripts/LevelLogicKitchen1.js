#pragma strict

public var amy: GameObject;
public var harry: GameObject;

private var player: GameObject;
private var playerName: String;

private var myCamera: Transform;
private var minXYTransform: Transform;
private var maxXYTransform: Transform;

private var myTransform: Transform;

private var gameLogic : GameLogic;			//To keep a reference to the GameLogic.js script
private var goals : Goals;					//To have a reference to the Goals.js script

//Script to keep the logic of the Kitchen 1 level
//Here will be done all the instructions to load the level and initialize the variables
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
	
	
	
	if(!amy || !harry) Debug.LogError("Missing player's prefab. Please add the prefabs of the players to the 'LevelLogicKirchen1.js' script.");
	
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
		
	}

}

function Start () {
	
	myCamera.SendMessage("SetPlayer", player.transform);							//Sets the camera's center to the player once the camera is instanced
	var minXY: Vector2 = minXYTransform.position;									//The bounds of the camera are fixed
	var maxXY: Vector2 = maxXYTransform.position;
	myCamera.SendMessage("SetBounds", new CameraBounds(maxXY, minXY)); 	//To set the boundaries of the camera
	
	if (gameLogic.checkConnection()){			//If we are authenticated in the web service
		var firstTrack: JSONObject = new JSONObject();	//Sending the track to the database..
		firstTrack.Add("type", "logic");
		firstTrack.Add("event", "Level 1 loaded");
		var tracks : JSONObject[] = new JSONObject[1];
		tracks[0] = firstTrack;
		DBconnector.Track(tracks);
	}
	else{
		Debug.Log("Connection not established (sessionKey not found) when trying to post the first trace.");
	}
	
	AddLevelGoals();		//Function to add the goals of this level
}

function Update () {

}

private function AddLevelGoals () {
	//Function to add the goals of this level
	
	goals.SetGoals("lucy", "photo", 3);			//The goal will be to take pictures to 3 lucy bacteria

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

public function LevelFinished () {		//This function will be called from the OnTriggerEnter() function of the portal (the game object that the player has to reach to complete the level if all the requirements are accomplished)
		//if all the goals are achieved goes to the next level.
		if (goals.GoalsAchieved()){
			//gameLogic.NextLevel();
			Debug.Log("All the goals are completed. Changing of level...");
		}
		else{
			Debug.Log("There is still at least one goal to complete. Complete it and try again.");
		}
	
}

