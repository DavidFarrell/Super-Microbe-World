#pragma strict

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

public static function SetInfo(lives: int, soap: int, wbc: int, ab: int){
	mytext = "Lives: " + lives + " Soap: " + soap + " White blood cells: " + wbc + " Antibiotics: " + ab;
	update = true;
}

@script RequireComponent(GUIText)