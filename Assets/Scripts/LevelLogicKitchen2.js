#pragma strict

public class LevelLogicKitchen2 extends LevelLogic{
	
	function Awake () {
		
		super.Awake();
		
	}

	function Start () {
		
		super.Start();
		
	}

	function Update () {

	}

	protected function AddLevelGoals () {
		//Function to add the goals of this level
		
		goals.SetGoals("patty", "photo", 3);			//The goal will be to take pictures to 3 patty

	}

}	//End of class brace.
