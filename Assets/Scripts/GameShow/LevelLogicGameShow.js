#pragma strict


public class LevelLogicGameShow extends MonoBehaviour{
	
	var gameHost : GameObject;
	var playerAmy : GameObject;
	var playerHarry : GameObject;
	
	private var player : String;
	
	private var amyAnim : Animator;
	private var harryAnim : Animator;
	private var hostAnim : Animator;
	
	var textBoxGameObject : GameObject;
	private var textBox : TextBox;			//To have a reference to the TextBox class in order to use its functions
	
	private var gameLogic : GameLogic;
	
	/*enum stateMachine {	introTalk = 0,
						playerSelection = 1,
						getDataForm = 2,
						shrinkingZone = 3,
						round1 = 4,
						round2 = 5,
						round3 = 6,
						round4 = 7,
						round5 = 8};
	
	private var state : stateMachine;*/
	
	function Awake () {
	
		player = "";
		gameLogic = GameObject.Find("GameLogic").GetComponent("GameLogic");
	
	}
	
	function Start () {
		
		//playerAmy = GameObject.Find("amy");
		//playerHarry = GameObject.Find("harry");
		
		//Load the animators
		amyAnim = playerAmy.GetComponent(Animator);
		harryAnim = playerHarry.GetComponent(Animator);
		hostAnim = gameHost.GetComponent(Animator);
		
		//To have a reference to the TextBox class in order to use it
		textBox = textBoxGameObject.GetComponent(TextBox);
		
		//state = stateMachine.introTalk;
		
		levelActions();
		
	}
	
	function Update () {
	
	}
	
	function levelActions () {
		
		/*
		write text welcome
		selection player Screen
		text
		get data form
		text
		shrink
		next level
		*/
		/*switch (state){
			
			case stateMachine.introTalk : 
				introTalk();
				break;
			case stateMachine.playerSelection :
				break;
			
		}*/
		
		yield introTalk();
		yield PlayerSelect();
		
		gameLogic.NextLevel();
		
		//yield PlayerSelect();
		
	}
	
	private function introTalk () {
		
		hostAnim.SetTrigger("excited");
		textBox.SetSpeaker("Game host");
		var intro : String[] = new String[3];
		intro[0] = "Hello and welcome to the e-Bug Game Show!";
		intro[1] = "Soon you will be visiting the weird world of the microbe.";
		intro[2] = "But first, who do you want to play as?";
		textBox.EnableTextBox();
		textBox.AddTextToShow(intro);
		yield textBox.ShowAllLines();
		textBox.DisableTextBox();
		hostAnim.SetTrigger("stop");
		
	}
	
	public function PlayerSelect () {
		
		//Save in vars the scripts of the players that control the OnMouseOver and the OnMouseDown behaviors
		var harryPlayerSelection : PlayerSelection = playerHarry.GetComponent("PlayerSelection");
		var amyPlayerSelection : PlayerSelection = playerAmy.GetComponent("PlayerSelection");
		
		harryPlayerSelection.SwitchSelMode(true);
		amyPlayerSelection.SwitchSelMode(true);
		
		//Waits while the player is being chosen
		yield;
		
		harryPlayerSelection.SwitchSelMode(false);
		amyPlayerSelection.SwitchSelMode(false);
	}
	
	public function PlayerChosen (playerName : String) {
		player = playerName;
		gameLogic.PlayerChosen(playerName);
		Debug.Log("Player chosen to play: " + playerName);
	}
	
}