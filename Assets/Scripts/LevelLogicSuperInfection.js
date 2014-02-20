#pragma strict

public class LevelLogicSuperInfection extends LevelLogic{
	
	function Awake () {
		
		super.Awake();
		
	}

	function Start () {
		
		super.Start();
		
		this.SetPickups(0, 0, 0);
		
	}

	function Update () {

	}

	protected function AddLevelGoals () {
		//Function to add the goals of this level
		
		goals.SetGoals("superinfection", "antibiotics", 1);
		
	}

}	//End of class brace.