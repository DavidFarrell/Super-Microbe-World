#pragma strict

public var textSize : Vector2;
public var upperLeftCorner : Vector2;
public var style : GUIStyle;

public var score: int = 0;
//private var up: int;
//private var left: int;

private var isEnabled = true;

function Start () {
	score = 0;
//	up = transform.position.y;
//	left = transform.position.x;
//	Debug.Log("Position: (" + up + ", " + left + ")");
	
}

function Update () {
	
	
	
}

function OnGUI () {
	if (isEnabled) {
		GUI.Label (Rect (upperLeftCorner.x, upperLeftCorner.y, textSize.x, textSize.y), score.ToString(), style);
	}
}

//Adds (substracts if negative) the amount of points to the score.
function ChangePoints (amount : int) {

	score += amount;
	if (score < 0) score = 0;	//There won't be a score lower than 0

}

public function Enable () {
	isEnabled = true;
}

public function Disable () {
	isEnabled = false;
}