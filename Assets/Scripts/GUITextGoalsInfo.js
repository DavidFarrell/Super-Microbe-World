#pragma strict

/*
This class manages the part of the GUI that shows the information about the goals to complete. 

Is for development purposes as is very basic and must be replaced by a real GUI.
*/

private static var mytext: String;
private static var update: boolean;

function Start () {

}

function Update () {

	if (update){
		GetComponent.<GUIText>().text = mytext;
		update = false;
	}

}

public static function SetInfoGoals(microbe: String, photos: int, wash: int, wbc: int, antibiotics: int, yoghurt: int){
//	mytext = "Microbe: " + microbe;
//	if (photos > 0) mytext = mytext + " Photos: " + photos;
//	if (wash > 0) mytext = mytext + " To wash: " + wash;
//	if (wbc > 0) mytext = mytext + " Wbc: " + wbc;
//	if (antibiotics > 0) mytext = mytext + " Antibiotics: " + antibiotics;
//	if (yoghurt > 0) mytext = mytext + " Yoghurt: " + yoghurt;
//	//mytext = "";	//To hide the temporal GUI once the definitive one is done
//	update = true;
	
}


@script RequireComponent(GUIText)