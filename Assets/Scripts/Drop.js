#pragma strict

private var hasCollidedAlready: boolean = false;
private var dropName: String;
private var collidedGameObject: GameObject;
//private var anim: Animator;

function Start () {

	hasCollidedAlready = false;
	dropName = transform.name;
	//anim = transform.GetComponent(Animator);				//NOTE that this can lead to performance issues if there's a lot of drops being shot as GetComponent takes a while... But probably this won't be an important issue.

}

function Update () {

}

function OnCollisionEnter2D (coll: Collision2D) {
	if(!hasCollidedAlready){
		//anim.SetTrigger("collide");			//Plays the collision animation
		collidedGameObject = coll.gameObject;
		hasCollidedAlready = true;
		//Debug.Log("Soap drop: Collision against: " + coll.gameObject.name);
		
		//transform.collider2D.enabled = false;				//
		
		if (collidedGameObject.layer == utils.layers.enemies || collidedGameObject.layer == utils.layers.nonEnemies)
				collidedGameObject.SendMessage("receiveDrop", dropName);
				
		/*if (coll.gameObject.layer == utils.layers.enemies)
			coll.gameObject.SendMessage("beKilled");
		*/
		
		transform.GetComponent(Animator).SetTrigger("collide");
		
		Destroy(gameObject, 0.15);								//Destroys the drop 0.2 seconds after playing the "collision" animation
		
		hasCollidedAlready = true;
	}
}

// Disables the behaviour when it is invisible
function OnBecameInvisible () {
	Destroy(gameObject, 0.5);
}