#pragma strict

public var xMargin: float = 2;		// Distance in the x axis the player can move before the camera follows.
public var yMargin: float = 2;		// Distance in the y axis the player can move before the camera follows.
public var xSmooth: float = 2;		// How smoothly the camera catches up with it's target movement in the x axis.
public var ySmooth: float = 2;		// How smoothly the camera catches up with it's target movement in the y axis.

private var maxXAndY: Vector2;		// The maximum x and y coordinates the camera can have.
private var minXAndY: Vector2;		// The minimum x and y coordinates the camera can have.
private var player: GameObject;

private var playerTransform: Transform;
private var myTransform: Transform;
//private var targetX: float;
//private var targetY: float;

function Awake () {
	
}

function Start () {

	//playerTransform = player.transform;
	myTransform = transform;

}

function FixedUpdate () {
	
	TrackPlayer();

}

function Update () {

	
	
	/*targetX = Mathf.Clamp(transform.position.x, minXAndY.x, maxXAndY.x);										// The target x and y coordinates should not be larger than the maximum or smaller than the minimum.
	targetY = Mathf.Clamp(transform.position.y, minXAndY.y, maxXAndY.y);
	myCamera.transform.position = new Vector3(targetX, targetY, myCamera.position.z);*/

}

function SetPlayer(plTr: Transform) {
	
	playerTransform = plTr;
	Debug.Log("Player set up succesfully!");
	
}

function SetBounds(bounds: LevelLogic.CameraBounds) {
	
	maxXAndY.x = bounds.maxXandY.x;
	maxXAndY.y = bounds.maxXandY.y;
	
	minXAndY.x = bounds.minXandY.x;
	minXAndY.y = bounds.minXandY.y;
	
	//Debug.Log("Bounds set up succesfully! \nMax: " + maxXAndY + "\nMin: " + minXAndY);
	
}

function TrackPlayer () {
	
	var targetX: float = transform.position.x;				// By default the target x and y coordinates of the camera are it's current x and y coordinates.
	var targetY: float = transform.position.y;

	
	if(CheckXMargin())							// If the player has moved beyond the x margin...
		targetX = Mathf.Lerp(transform.position.x, playerTransform.position.x, xSmooth * Time.deltaTime);	// ... the target x coordinate should be a Lerp between the camera's current x position and the player's current x position.

	if(CheckYMargin())							// If the player has moved beyond the y margin...
		targetY = Mathf.Lerp(transform.position.y, playerTransform.position.y, ySmooth * Time.deltaTime);	// ... the target y coordinate should be a Lerp between the camera's current y position and the player's current y position.

	targetX = Mathf.Clamp(targetX, minXAndY.x, maxXAndY.x);										// The target x and y coordinates should not be larger than the maximum or smaller than the minimum.
	targetY = Mathf.Clamp(targetY, minXAndY.y, maxXAndY.y);
	
	transform.position = Vector3(targetX, targetY, transform.position.z);						// Set the camera's position to the target position with the same z component.
	
}

//Returns true if the distance between the camera and the player in the x axis is greater than the x margin.
function CheckXMargin () {
		
		return (Mathf.Abs(myTransform.position.x - playerTransform.position.x) > xMargin);

}

//Returns true if the distance between the camera and the player in the x axis is greater than the x margin.
function CheckYMargin () {

		return (Mathf.Abs(myTransform.position.y - playerTransform.position.y) > yMargin);

}

/*

function FixedUpdate () {

	
	targetX = myCamera.position.x;				// By default the target x and y coordinates of the camera are it's current x and y coordinates.
	targetY = myCamera.position.y;

	
	if(CheckXMargin())							// If the player has moved beyond the x margin...
		targetX = Mathf.Lerp(targetX, player.position.x, xSmooth * Time.deltaTime);	// ... the target x coordinate should be a Lerp between the camera's current x position and the player's current x position.

	if(CheckYMargin())							// If the player has moved beyond the y margin...
		targetY = Mathf.Lerp(targetY, player.position.y, ySmooth * Time.deltaTime);	// ... the target y coordinate should be a Lerp between the camera's current y position and the player's current y position.

	targetX = Mathf.Clamp(targetX, minXAndY.x, maxXAndY.x);										// The target x and y coordinates should not be larger than the maximum or smaller than the minimum.
	targetY = Mathf.Clamp(targetY, minXAndY.y, maxXAndY.y);
	
	myCamera.position = new Vector3(targetX, targetY, myCamera.position.z);							// Set the camera's position to the target position with the same z component.

}

*/