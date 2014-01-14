#pragma strict

public var LevelLogicScript: MonoScript;

function Start () {
	
}

function Update () {

}

function OnTriggerEnter(){

	//Tell the LevelLogic script to check if the goals were achieved and if so go to the next level. This operations are done by the "LevelFinished()" function.
	
	LevelLogicScript.LevelFinished();	//Communicates with the level logic to try to finish this level checking that all the goals have been completed.
	//TODO Can't access LevelFinished this way. Check tomorrow how to do it.
}