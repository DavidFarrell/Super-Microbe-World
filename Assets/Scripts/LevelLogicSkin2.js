#pragma strict

public class LevelLogicSkin2 extends LevelLogic{
	
	function Awake () {
		
		super.Awake();
		
	}

	function Start () {
		
		super.Start();
//		this.SetPickups(0, 0, 0);
		ShowInfoLevel();
		
	}

//	function Update () {
//
//	}

	protected function AddLevelGoals () {
		//Function to add the goals of this level
		
		goals.SetGoals("steve", "photo", 3);			//The goal will be to take pictures to 3 patty

	}
	
	public function ShowInfoLevel(){
		super.ShowInfoLevel();
		//yield new WaitForSeconds(0.2);
		GUIHandler.showInfoLevel("skin2"/*GameLogic.GameLevel.skin2*/, this);		//Plays the instruction animation for this level, the level one.
	}

}	//End of class brace.