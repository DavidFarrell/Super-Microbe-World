#pragma strict

public class MicrobeLucy extends WalkingMicrobe {
	
	public var jumpForce: Vector2 = Vector2(5, 50);
	
	private var jumped: boolean = false;
	private var canJump: boolean = false;
	private var yoghurtPosition: int; 				//+1 if the yoghurt is on the right, and -1 if it is on the left. Used to decide the direction of the jump.
	private var yoghurtGO: GameObject;				//To have a reference to the gameobject of the yoghurt
	
	function Awake () {
	
		super.Awake();
		jumped = false;
		canJump = false;
		
	}
	
	function OnTriggerEnter2D(collisionInfo : Collider2D){
		
		var objectHit: GameObject = collisionInfo.gameObject;
		
		if(objectHit.tag == "Yoghurt"){
			if(!canJump){
				if(objectHit.transform.position.x > myTransform.position.x)			//The yoghurt is on the right.
					yoghurtPosition = 1; 
				else
					yoghurtPosition = -1; 
				Debug.Log("Lucy: Trigger entered. Yoghurt detected!");
				canJump = true;
				yoghurtGO = objectHit;
			}
		}
		
		else{
			Debug.Log("Lucy: Trigger entered, but not Yoghurt");
			super.OnTriggerEnter2D(collisionInfo);								//To call the OnTriggerEnter2D of WalkingMicrobe's script.
		}
		
	}
	
	function OnTriggerExit2D(other: Collider2D) {
		Debug.Log("Lucy: Trigger exited.");
		canJump = false;
		yoghurtGO = null;
	}
	
	//If Lucy is hit while standing in the area near the yoghurt where it can jump, and the yoghurt and collision are on the right(approppriate) it jumps
	function OnCollisionEnter2D (coll: Collision2D) {
		var objectCollided: GameObject = coll.collider.gameObject;
		if(canJump && objectCollided.layer == utils.layers.player 
			&& ((objectCollided.transform.position.x > myTransform.position.x && yoghurtPosition == -1) 		//Lucy is pushed from her right side and the yoghurt is on the left
				|| (objectCollided.transform.position.x < myTransform.position.x && yoghurtPosition == 1))){	//Lucy is pushed from her left side and the yoghurt is on the right
			if (!jumped){
				jumpToYoghurt();
			}
		}
		else
			super.OnCollisionEnter2D(coll);
		
	}
	
	protected function Flip () {
		//This function prevents lucy from turning when it has jumped
		if (!jumped){
			super.Flip();
		}
	}
	
	private function jumpToYoghurt() {
		iTween.Stop(gameObject);						//Stops all the iTweens of this gameObject
		jumpForce.x = jumpForce.x * yoghurtPosition;					//To jump left or right depending on the position of the yoghurt
		myTransform.rigidbody2D.AddForce(jumpForce);
		jumped = true;
		anim.SetTrigger("dive");
		
		goals.UpdateGoals(microbeName, "thrown to yoghurt");				//To inform the Goals.js script about the change
		
		if (yoghurtGO) yoghurtGO.SendMessageUpwards("DrawYoghurt", 1.9);					//Tells the yoghurt's script to draw yoghurt overflowing the yoghurt can, to show that yoghurt was created. The number is the delay. 
		
		disableColliders();
		
		Destroy(gameObject, 3);
	}
	
}