#pragma strict

/*
This class manages the part of the GUI that shows the information about the Player (lives, amount of throwable objects..) to complete. 

Is for development purposes as is very basic and must be replaced by a real GUI.
*/

private static var mytext: String;
private static var update: boolean;

function Start () {
	
	
	
}

function Update () {

	if (update){
		guiText.text = mytext;
		update = false;
	}

}

public static function SetInfoPlayer(lives: int, soap: int, wbc: int, ab: int){
//	mytext = "Lives: " + lives + " Soap: " + soap + " White blood cells: " + wbc + " Antibiotics: " + ab;
//	update = true;
}

@script RequireComponent(GUIText)