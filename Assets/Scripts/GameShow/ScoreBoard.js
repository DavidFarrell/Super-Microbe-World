#pragma strict

public var textSize : Vector2;
public var upperLeftCorner : Vector2;
public var style : GUIStyle;

public var score: int = 0;
//private var up: int;
//private var left: int;

function Start () {
	score = 0;
//	up = transform.position.y;
//	left = transform.position.x;
//	Debug.Log("Position: (" + up + ", " + left + ")");
	
}

function Update () {
	
	
	
}

function OnGUI () {
	GUI.Label (Rect (upperLeftCorner.x, upperLeftCorner.y, textSize.x, textSize.y), score.ToString(), style);
	//GUI.Label (Rect (25, 25, 100, 30), "Label");

}

//Adds (substracts if negative) the amount of points to the score.
function ChangePoints (amount : int) {

	score += amount;

}