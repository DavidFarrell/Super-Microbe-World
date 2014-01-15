#pragma strict

private var gameLogic: GameLogic;			//To keep a reference to the GameLogic.js script
private var canCheck: boolean = true;				

function Start () {
	
	var gameLogicGO : GameObject;
	gameLogicGO = GameObject.Find("GameLogic");
	if (gameLogicGO){
		gameLogic = gameLogicGO.GetComponent("GameLogic");					//BE CAREFUL!! GameLogic is a GameObject that is created in the first scene and is never destroyed when changing between scenes!
																			//That means that if this scene is played directly there will be here a null reference!!!!!!!
	}
	else{
		Debug.LogError("GameLogic object not found");
	}
}

function Update () {

}

function OnTriggerEnter2D(){

	//Tell the LevelLogic script to check if the goals were achieved and if so go to the next level. This operations are done by the "LevelFinished()" function.
	if (canCheck){
		canCheck = false;
		Debug.Log("Trying to change of level...");
		gameLogic.NextLevel();	//Communicates with the game logic to try to finish this level checking that all the goals have been completed.
		WaitOneSecond();
	}
}

private function WaitOneSecond(){
	yield new WaitForSeconds(1);
	canCheck = true;
}