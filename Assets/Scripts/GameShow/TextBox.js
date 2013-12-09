#pragma strict

var upperLeftCorner : Vector2;
var textSize : Vector2;
var style : GUIStyle;
//var content : GUIContent;
private var textToShow : String;

function Start () {
	
	textToShow = "Write something!";
	
	Debug.Log("Rectangle: " + upperLeftCorner.x + ", " + upperLeftCorner.y + ", " + textSize.x + ", " + textSize.y);

}

function Update () {

}

function OnGui () {

	//GUI.Label(Rect(upperLeftCorner.x, upperLeftCorner.y, size.x, size.y), content, style);
	GUI.Label (Rect (upperLeftCorner.x, upperLeftCorner.y, textSize.x, textSize.y), textToShow);//, style);

}