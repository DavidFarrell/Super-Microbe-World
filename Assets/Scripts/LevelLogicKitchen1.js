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

//Script to keep the logic of the Kitchen 1 level
//Here will be done all the instructions to load the level and initialize the variables
function Awake () {
	
	var gameLogicGO : GameObject;
	gameLogicGO = GameObject.Find("GameLogic");
	if (gameLogicGO){
		gameLogic = gameLogicGO.GetComponent("GameLogic");					//BE CAREFUL!! GameLogic is a GameObject that is created in the first scene and is never destroyed when changing between scenes!
	}																				//That means that if this scene is played directly there will be here a null reference!!!!!!!
	else{
		Debug.LogError("GameLogic Object not found. This will be because GameLogic is created in the first level of the game, the GameShow level, and is intended to pass (be kept alive) throughout all the scenes in the game. So, if the Kitchen level is played, this object won't exist, and there must be many Null reference errors. But none of this errors will avoid playing the game. ");
	}
	
	myTransform = transform;
	
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
}

function Update () {

}

public class CameraBounds{		//The purpose of this class is to keep the settings of the camera in an obect, so we'll be able to send this settings to the camera game object using the SendMessage() function
								//which only accepts one argument to pass
	public var maxXandY: Vector2;
	public var minXandY: Vector2;
	
	public function CameraBounds(maxXY: Vector2, minXY: Vector2){
		maxXandY = maxXY;
		minXandY = minXY;
	}
}

public function LevelFinished () {		//This function will be called from the OnTriggerEnter() function of the portal (the game object that the player has to reach to complete the level if all the requirements are accomplished)
		//if all the goals are achieved goes to the next level.
		
	//	gameLogic.NextLevel();
}

public class Goals{
	
	private var counterChanged : boolean;
	private var counter : int[][];	/*This matrix will contain one row per microbe. Each row refers to the information of a microbe. 
									For each row, the position 0 is for the number of photographs of this microbe needed, the position 1 for the number of deaths caused by being washed away, 
									the position 2 for the deaths by white blood cells, and the last one, the position 3 for the number of deaths caused by antibiotics.
	Here is the correspondence with numbers and microbes: 
		00 lucy
		01 patty
		02 donna
		03 slarg
		04 slurm
		05 colin
		06 super_colin
		07 sandy
		08 steve
		09 iggy
		10 super_slurm
	For example, if the 5th row is [0, 3, 0, 0] that means that to complete this level, we need to wash away 3 colin microbes.
	*/
	public function Goals{
		counterChanged = true;
		counter = new [] [11];
		for (var i : int = 0; i < 10; i++){
			counter [i] = new int [4];
			for (var j : int = 0; i < 4; i++){
				counter[i][j] = 0;
			}
		}
		SetGoals();
	}
	
	private function SetGoals(){		//In this method has to be set the goals of the different levels 
		counter[0][0] = 3;				//We'll need to photograph 3 different lucy bacteria to complete the level
	}
	
	public function GoalsAchieved() : boolean {
		if(counterChanged){							//If there is no changes on the matrix is unuseful to check if there is all the goals have been achieved
			for (var i : int = 0; i < 10; i++){
				for (var j : int = 0; i < 4; i++){
					if (counter[i][j] != 0) {
						counterChanged = false;		//This loop won't be executed again unless counterChanged were true. counterChanged will be changed to true when the counter matrix suffers any change.
						return false;	//If there is any position different from 0, there is at least one goal without accomplish					
					}
				}
			}
			counterChanged = false;
			return true;
		}
		else return false;
	}
	
	public function UpdateGoals(microbe: string, action: string){
		//Will be called from the microbes' scripts when the microbe is photographed, washed away, killed by a white blood cell or by antibiotic. 
		//The first parameter is to say the name of the microbe that suffered the action, and the second is for the action itself. 
		//The parameters must take the values contained in the switch statements
		var mic: int;
		var act: int;
		switch(microbe){
			case "lucy":
				mic = 0;
				break;
			case "patty": 
				mic = 1;
				break;
			case "donna": 
				mic = 2;
				break;
			case "slarg": 
				mic = 3;
				break;
			case "slurm": 
				mic = 4;
				break;
			case "colin": 
				mic = 5;
				break;
			case "super_colin": 
				mic = 6;
				break;
			case "sandy": 
				mic = 7;
				break;
			case "steve": 
				mic = 8;
				break;
			case "iggy": 
				mic = 9;
				break;
			case "super_slurm": 
				mic = 10;
				break;
			default: mic = -1;
		}
		switch(action){
			case "photo":
				act = 0;
				break;
			case "washed up":
				act = 1;
				break;
			case "white blood cell":
				act = 2;
				break;
			case "antibiotics":
				act = 3;
				break;
				default = -1;
		}
		if (mic == -1 || act = -1) Debug.Log("Error when reading action or microbe parameters!"); 
		if (counter[mic][act] > 0) { 
			counter[mic][act]--;	//One goal achieved, one goal less to accomplish.
			counterChanged = true;	//The next time that we call GoalsAchieved function, the matrix will be checked
		}
	}
	
}