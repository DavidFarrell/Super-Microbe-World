#pragma strict

public var amy: GameObject;
public var harry: GameObject;

private var player: GameObject;
private var playerName: String;

private var myCamera: Transform;
private var minXYTransform: Transform;
private var maxXYTransform: Transform;

private var myTransform: Transform;

//Here will be done all the instructions to load the level and initialize the variables
function Awake () {
	
	myTransform = transform;
	
	if(!amy || !harry) Debug.LogError("Missing player's prefab. Please add the prefabs of the players to the 'loadPlayer.js' script.");
	
	var start: Transform = myTransform.Find("level_start");			//Looks for the start_point GameObject, that is (or should be) a son of the GameObject this script is attached to.
	
	myCamera = myTransform.Find("main_camera");
	minXYTransform = myTransform.Find("main_camera_LowerLeftEdge").transform;
	maxXYTransform = myTransform.Find("main_camera_UpperRightEdge").transform;
	
	if (!start){													//It checks if start exists
		Debug.LogError("Start point not found.");
	}
	else{
		if (PlayerPrefs.HasKey("player"))
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
}

//Here will be done all the 
function Update () {

}

public class CameraBounds{

	public var maxXandY: Vector2;
	public var minXandY: Vector2;
	
	public function CameraBounds(maxXY: Vector2, minXY: Vector2){
	
		maxXandY = maxXY;
		minXandY = minXY;
	
	}

}